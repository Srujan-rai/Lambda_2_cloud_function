import argparse
import boto3
import zipfile
import os
import requests
import shutil
import re
import logging
import datetime # For README timestamp

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')

def download_lambda_code(function_name, region_name=None):
    """
    Downloads the AWS Lambda function code, its configuration, and extracts it.

    Args:
        function_name (str): The name of the AWS Lambda function.
        region_name (str, optional): The AWS region of the Lambda function.

    Returns:
        tuple: (extract_path, handler_file_from_aws_config, handler_function_name,
                runtime, env_vars, layers_info, timeout, memory_size)
               or None if an error occurs.
    """
    try:
        # Initialize Boto3 client for Lambda
        # If region_name is None, Boto3 will use the default region from AWS config or environment variables.
        client = boto3.client('lambda', region_name=region_name)
        effective_region = client.meta.region_name # Get the region Boto3 is actually using
        logging.info(f"Fetching function configuration for '{function_name}' in region '{effective_region}'...")

        # Get function details, including the pre-signed URL for the code
        response = client.get_function(FunctionName=function_name)

        code_url = response['Code']['Location']
        config = response['Configuration']
        handler_string = config['Handler'] # e.g., "main.handler" or "filename.handler_function"
        runtime = config['Runtime']
        env_vars = config.get('Environment', {}).get('Variables', {}) # Get environment variables
        layers_info = config.get('Layers', []) # Get layer information
        timeout = config.get('Timeout') # Get timeout in seconds
        memory_size = config.get('MemorySize') # Get memory in MB

        if not handler_string:
            logging.error("Could not retrieve handler string from Lambda configuration.")
            return None

        # Parse the handler string to get the file name and function name
        # AWS Lambda handler is typically in the format 'filename.handler_function_name'
        if '.' in handler_string:
            handler_file_name_part, handler_function_name = handler_string.rsplit('.', 1)
            # Assume .py extension for Python runtimes. This script primarily targets Python.
            handler_file_from_aws_config = handler_file_name_part + ".py" if "python" in runtime.lower() else handler_file_name_part
        else:
            # This case is less common for well-configured Python Lambdas.
            # If only a function name is provided (e.g., "handler"), AWS Lambda searches for it.
            # We'll assume the function name is the handler_string and search for it in common files.
            logging.warning(
                f"Handler string '{handler_string}' does not explicitly specify a file (e.g., 'filename.handler'). "
                f"Assuming function name is '{handler_string}'. The script will attempt to find this function in common .py files."
            )
            handler_file_from_aws_config = None # Flag that we need to search for the file
            handler_function_name = handler_string

        logging.info(f"Lambda Handler (from AWS config): {handler_string} -> File: {handler_file_from_aws_config or 'Search needed'}, Function: {handler_function_name}")
        logging.info(f"Runtime: {runtime}, Timeout: {timeout}s, Memory: {memory_size}MB")
        if env_vars:
            logging.info(f"Lambda Environment Variables found: {list(env_vars.keys())}")
        if layers_info:
            logging.info(f"Lambda Layers found: {[layer['Arn'] for layer in layers_info]}")

        # Download the Lambda function code (zip file)
        logging.info(f"[📥] Downloading Lambda code from presigned URL...")
        zip_path = f"{function_name}.zip" # Temporary local name for the zip file
        r = requests.get(code_url)
        r.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        with open(zip_path, 'wb') as f:
            f.write(r.content)
        logging.info(f"[✅] Downloaded to: {zip_path}")

        # Extract the code from the zip file
        extract_path = f"{function_name}_code" # Temporary directory to extract code
        if os.path.exists(extract_path):
            shutil.rmtree(extract_path) # Clean up if the directory already exists from a previous run
        os.makedirs(extract_path, exist_ok=True)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        logging.info(f"[✅] Extracted code to: {extract_path}")

        # Return all fetched and derived information
        return extract_path, handler_file_from_aws_config, handler_function_name, runtime, env_vars, layers_info, timeout, memory_size

    except boto3.exceptions.ClientError as e:
        logging.error(f"AWS Boto3 client error: {e}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to download Lambda code: {e}")
    except zipfile.BadZipFile:
        logging.error(f"Failed to unzip the file '{zip_path}'. It may be corrupted or not a zip file.")
    except Exception as e:
        logging.error(f"An unexpected error occurred during download/extraction: {e}", exc_info=True) # Log full traceback
    return None


def convert_to_gcp_function(aws_function_name_for_readme, extract_path, output_path,
                              lambda_handler_file_from_aws, lambda_handler_function_from_aws,
                              lambda_runtime, lambda_env_vars, lambda_layers,
                              lambda_timeout, lambda_memory):
    """
    Converts the extracted AWS Lambda code to a Google Cloud Function structure.
    Creates 'main.py', 'requirements.txt', and 'CONVERSION_README.md'.
    """
    try:
        # Prepare the output directory for GCP function files
        if os.path.exists(output_path):
            logging.info(f"Cleaning up existing output directory: {output_path}")
            shutil.rmtree(output_path)
        os.makedirs(output_path, exist_ok=True)

        # --- 1. Locate the actual handler file and read its code ---
        actual_handler_file_path = None
        resolved_handler_file_name_in_zip = None # Relative path of the handler file within the zip

        # Attempt 1: Use the handler file name directly from AWS config if available
        if lambda_handler_file_from_aws:
            # Search for the file within the extracted code (could be in a subdirectory)
            for root, _, files in os.walk(extract_path):
                if lambda_handler_file_from_aws in files:
                    actual_handler_file_path = os.path.join(root, lambda_handler_file_from_aws)
                    resolved_handler_file_name_in_zip = os.path.relpath(actual_handler_file_path, extract_path)
                    logging.info(f"Found specified handler file '{lambda_handler_file_from_aws}' at: {actual_handler_file_path}")
                    break # File found
            if not actual_handler_file_path:
                 logging.warning(f"Specified handler file '{lambda_handler_file_from_aws}' not found in extracted code. Will search common files.")

        # Attempt 2: If not found or not specified, search common Python files or any .py file for the handler function
        if not actual_handler_file_path:
            common_py_files_to_check = ['main.py', 'app.py', 'handler.py', 'lambda_function.py'] # Prioritized search list
            # First, check root of extract_path for common files
            for py_file_name in common_py_files_to_check:
                potential_path = os.path.join(extract_path, py_file_name)
                if os.path.exists(potential_path):
                    try:
                        with open(potential_path, 'r', encoding='utf-8') as f_check:
                            code_check = f_check.read()
                        # Check if the handler function exists in this file
                        if re.search(rf"def\s+{re.escape(lambda_handler_function_from_aws)}\s*\(", code_check):
                            actual_handler_file_path = potential_path
                            resolved_handler_file_name_in_zip = py_file_name
                            logging.info(f"Found handler function '{lambda_handler_function_from_aws}' in common file: '{py_file_name}'.")
                            break # Found
                    except Exception as e_read: logging.debug(f"Could not read/check {potential_path}: {e_read}")
            # If still not found, search all .py files in the extracted package (including subdirectories)
            if not actual_handler_file_path:
                for root, _, files_in_subdir in os.walk(extract_path):
                    for file_in_zip in files_in_subdir:
                        if file_in_zip.endswith(".py"):
                            potential_path = os.path.join(root, file_in_zip)
                            try:
                                with open(potential_path, 'r', encoding='utf-8') as f_check:
                                    code_check = f_check.read()
                                if re.search(rf"def\s+{re.escape(lambda_handler_function_from_aws)}\s*\(", code_check):
                                    actual_handler_file_path = potential_path
                                    resolved_handler_file_name_in_zip = os.path.relpath(actual_handler_file_path, extract_path)
                                    logging.info(f"Found handler function '{lambda_handler_function_from_aws}' in nested file: '{resolved_handler_file_name_in_zip}'.")
                                    break # Found in a nested file
                            except Exception as e_read: logging.debug(f"Could not read/check {potential_path}: {e_read}")
                    if actual_handler_file_path: break # Found, exit outer loop

        if not actual_handler_file_path:
            logging.error(f"CRITICAL: Could not locate the handler file containing function '{lambda_handler_function_from_aws}'.")
            logging.error("Searched for AWS-configured file and common Python files. Please check your Lambda configuration and package.")
            logging.error(f"Files found in '{extract_path}':")
            for r, _, f_list in os.walk(extract_path): # Changed d to _ as it's not used
                for name in f_list: logging.error(f"  - {os.path.join(r, name)}")
            return False # Indicate failure

        logging.info(f"Using '{resolved_handler_file_name_in_zip}' as the source for 'main.py'.")
        with open(actual_handler_file_path, 'r', encoding='utf-8') as f:
            code = f.read()

        # --- Transform the handler code for GCP HTTP Trigger ---
        # Regex to find 'def handler_name(event_param, context_param):'
        # It captures the original event and context parameter names.
        handler_pattern_aws = re.compile(
            rf"def\s+{re.escape(lambda_handler_function_from_aws)}\s*"  # def function_name
            r"\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)\s*:"     # ( event_param , context_param ):
        )
        match = handler_pattern_aws.search(code)
        original_event_param_name_in_code = "event" # Default if no match or for comments

        if match:
            original_event_param_name_in_code = match.group(1) # Captured event parameter name
            original_context_param_name_in_code = match.group(2) # Captured context parameter name

            # Replacement string for GCP HTTP-triggered function
            # The GCP entry point for HTTP triggers is typically 'def main(request):'
            gcp_http_replacement_string = (
                f"def main(request):\n"
                f"    # Original AWS Lambda event parameter was named '{original_event_param_name_in_code}'.\n"
                f"    # For a GCP HTTP-triggered function, the request data is in the 'request' object (typically a Flask request object).\n"
                f"    # This attempts to get JSON from the request body. Adapt as per your actual data structure and trigger.\n"
                f"    {original_event_param_name_in_code} = request.get_json(silent=True) if request.is_json and request.content_length else {{}}\n"
                f"    # If your Lambda was triggered by non-HTTP events (e.g., S3, SQS, Kinesis),\n"
                f"    # how you derive '{original_event_param_name_in_code}' will differ based on the GCP trigger and its event payload.\n"
                f"    # Example for GCP Pub/Sub trigger (where 'request' is actually the event data dict):\n"
                f"    # import base64, json\n"
                f"    # if isinstance(request, dict) and 'data' in request:\n"
                f"    #     try: {original_event_param_name_in_code} = json.loads(base64.b64decode(request['data']).decode('utf-8'))\n"
                f"    #     except Exception as e_ps_parse: print(f'Error parsing Pub/Sub data: {{e_ps_parse}}'); {original_event_param_name_in_code} = {{}}\n\n"
                f"    # The AWS Lambda 'context' object (originally named '{original_context_param_name_in_code}') is NOT directly available in GCP HTTP Functions.\n"
                f"    # Any code that used attributes or methods of the AWS 'context' object (e.g., context.get_remaining_time_in_millis())\n"
                f"    # MUST BE REMOVED OR REFACTORED.\n"
                f"    # GCP background functions (e.g., Pub/Sub, GCS) receive a 'google.cloud.functions.Context' object, which is different.\n"
                f"    # context = None # Placeholder, if your adapted code needs a 'context' variable for some reason.\n"
            )
            code = handler_pattern_aws.sub(gcp_http_replacement_string, code, 1) # Replace only the first match
            logging.info(f"Replaced AWS Lambda handler signature for function '{lambda_handler_function_from_aws}'. Target GCP function: main(request).")
        else:
            logging.warning(
                f"Could not find the standard AWS handler signature 'def {lambda_handler_function_from_aws}(event, context):' "
                f"in '{resolved_handler_file_name_in_zip}'. The file will be copied as 'main.py', but you MUST MANUALLY "
                f"adapt the handler function signature and logic for GCP."
            )

        # --- 2. Write the (potentially modified) code to output/main.py ---
        # This will be the entry point for the GCP function.
        target_main_py_path = os.path.join(output_path, 'main.py')
        with open(target_main_py_path, 'w', encoding='utf-8') as f:
            f.write(code)
        logging.info(f"Handler code written to: {target_main_py_path}")

        # --- 3. Copy all other files and directories from extract_path to output_path ---
        # This ensures all supporting files, modules, and assets are included.
        logging.info(f"Copying other files and directories from '{extract_path}' to '{output_path}'...")
        for item_name in os.listdir(extract_path):
            source_item_full_path = os.path.join(extract_path, item_name)
            target_item_full_path = os.path.join(output_path, item_name)

            # Check if the current item is the file that was processed as the handler
            is_original_handler_file = (os.path.normpath(source_item_full_path) == os.path.normpath(actual_handler_file_path))

            if is_original_handler_file:
                # The handler file's content is already in main.py.
                # Do not copy it again under its original name if it wasn't 'main.py'.
                if item_name != 'main.py':
                    logging.debug(f"Skipping copy of original handler file '{item_name}' as its content is now in 'main.py'.")
                    continue
                # If original was main.py, it's already handled by writing target_main_py_path.
                elif item_name == 'main.py': # This 'elif' ensures it's skipped if it was the handler and named main.py
                     continue

            # Copy directories recursively, and files directly
            if os.path.isdir(source_item_full_path):
                shutil.copytree(source_item_full_path, target_item_full_path, dirs_exist_ok=True)
            else: # It's a file
                shutil.copy2(source_item_full_path, target_item_full_path) # copy2 preserves metadata
        logging.info(f"Finished copying other files and directories.")
        if resolved_handler_file_name_in_zip and os.path.dirname(resolved_handler_file_name_in_zip):
            logging.warning(f"Original handler '{resolved_handler_file_name_in_zip}' was in a subdirectory. "
                            "Relative imports in 'main.py' might need adjustment (e.g., 'from . import mymodule' "
                            "if mymodule was at the same level as the original handler).")


        # --- 4. Handle requirements.txt ---
        source_requirements_path = None
        # Search for requirements.txt anywhere in the extracted package
        for root, _, files_in_subdir in os.walk(extract_path):
            if 'requirements.txt' in files_in_subdir:
                source_requirements_path = os.path.join(root, 'requirements.txt')
                logging.info(f"Found 'requirements.txt' at {os.path.relpath(source_requirements_path, extract_path)}")
                break

        target_requirements_path = os.path.join(output_path, 'requirements.txt')
        if source_requirements_path and os.path.exists(source_requirements_path):
            shutil.copy2(source_requirements_path, target_requirements_path)
            logging.info(f"Copied 'requirements.txt' from Lambda package.")
            with open(target_requirements_path, 'a', encoding='utf-8') as f: # Append warning
                f.write("\n# --- Autogenerated Conversion Warning --- #\n")
                f.write("# CRITICAL: Review these dependencies carefully.\n")
                f.write("# - AWS-specific libraries (e.g., boto3, aws-lambda-powertools) WILL NOT WORK in GCP\n")
                f.write("#   and MUST be replaced with Google Cloud client libraries (e.g., google-cloud-storage, google-cloud-pubsub).\n")
                f.write("# - Ensure all other dependencies are compatible with the target GCP Python runtime.\n")
                f.write("# - Remove any dependencies that were provided by the AWS Lambda runtime itself if not needed.\n")
        else:
            # Create a new requirements.txt if none was found
            with open(target_requirements_path, 'w', encoding='utf-8') as f:
                f.write("# --- Autogenerated requirements.txt --- #\n")
                f.write("# No 'requirements.txt' found in the original Lambda package, or it was empty.\n")
                f.write("# CRITICAL: Add all necessary Python dependencies for your GCP function here.\n")
                f.write("# For example: \n")
                f.write("#   functions-framework # Usually required for Python GCP Functions\n")
                f.write("#   google-cloud-storage\n")
                f.write("#   google-cloud-pubsub\n")
                f.write("# Replace AWS SDK dependencies (like boto3) with their Google Cloud equivalents.\n")
            logging.info(f"Created a new 'requirements.txt' as none was found in the Lambda package.")

        # --- 5. Add CONVERSION_README.md with crucial manual steps ---
        current_datetime_iso = datetime.datetime.now().isoformat() # Get current timestamp
        readme_content = f"""# AWS Lambda to Google Cloud Function Conversion Report

**DATE:** {current_datetime_iso}

## Original AWS Lambda Details
- **Function Name (AWS):** `{aws_function_name_for_readme}`
- **Handler (AWS Config):** `{lambda_handler_file_from_aws or 'N/A'}.{lambda_handler_function_from_aws}`
- **Resolved Handler File in Zip:** `{resolved_handler_file_name_in_zip or 'Could not resolve / Not applicable'}`
- **Original Runtime (AWS):** `{lambda_runtime}`
- **Original Timeout (AWS):** `{lambda_timeout} seconds`
- **Original Memory (AWS):** `{lambda_memory} MB`

## Conversion Summary & CRITICAL Manual Steps Required:

This script provides a **basic structural conversion**. It **DOES NOT** automatically handle code logic, SDK calls, IAM permissions, or complex trigger differences. **Significant manual review and code adaptation are ESSENTIAL for a successful migration.**

### 1. Review `main.py` (Converted Handler Code)
   - **Entry Point:** The AWS Lambda handler function (`{lambda_handler_function_from_aws}`) has been converted (or attempted to be converted) to `def main(request):` in `main.py`. This assumes a **HTTP-triggered** Google Cloud Function by default.
   - **Event Data (`{original_event_param_name_in_code}` variable in `main.py`):**
     - The script attempts to derive this from `request.get_json()`.
     - **CRITICAL:** If your Lambda was triggered by S3, SQS, Kinesis, DynamoDB Streams, CloudWatch Events, etc., the event structure is different. You **MUST** adapt `main.py` to correctly parse the `request` object (for HTTP triggers) or the `event` and `context` parameters (for background triggers like Pub/Sub, GCS) according to the GCP trigger you configure. Consult GCP documentation for specific event payloads.
   - **AWS `context` Object:**
     - The AWS Lambda `context` object (and its methods like `get_remaining_time_in_millis()`, attributes like `function_name`, `aws_request_id`, `log_stream_name`) **IS NOT AVAILABLE** in GCP HTTP functions.
     - Any code relying on the AWS `context` object **MUST BE REMOVED OR REFACTORED.**
     - GCP background functions receive a `google.cloud.functions.Context` object, which has a different structure and purpose.

### 2. Update `requirements.txt` (Dependencies)
   - **CRITICAL: Replace AWS SDKs and AWS-specific libraries.**
     - `boto3`, `aws-lambda-powertools`, etc., **WILL NOT WORK** in GCP.
     - Replace them with their Google Cloud equivalents (e.g., `google-cloud-storage`, `google-cloud-pubsub`, `google-cloud-firestore`, `google-cloud-logging`).
   - Ensure all other dependencies are compatible with your target GCP Python runtime.
   - Add `functions-framework` if not already present, as it's often used by GCP Python functions.
   - Remove any libraries that were provided by the AWS Lambda runtime environment if they are not explicitly needed.

### 3. Configure Environment Variables in GCP
   - Original AWS Lambda environment variables:
```
"""
        if lambda_env_vars:
            for key, value in lambda_env_vars.items():
                readme_content += f"     {key}: {value}\n"
        else:
            readme_content += "     None configured.\n"
        readme_content += """```
   - **CRITICAL: Manually configure these or their equivalents in your Google Cloud Function deployment.** Use Secret Manager for sensitive values.

### 4. Set Up IAM Permissions / Service Accounts in GCP
   - The AWS Lambda's IAM execution role **has not been translated.**
   - **CRITICAL: Create or assign an appropriate IAM service account for your Google Cloud Function.** Grant it the necessary roles/permissions on GCP resources (e.g., `roles/storage.objectAdmin` to access Cloud Storage, `roles/pubsub.publisher` to publish to Pub/Sub, `roles/logging.logWriter` for explicit logging permissions if needed).

### 5. Define Triggers in GCP
   - The conversion script defaults to an HTTP trigger structure for `main.py`.
   - **CRITICAL:** If your Lambda used a non-HTTP trigger (e.g., S3, SQS, DynamoDB, CloudWatch Events):
     - Choose the equivalent trigger in Google Cloud Functions (e.g., Cloud Storage trigger, Pub/Sub trigger, Firestore trigger, Eventarc trigger).
     - **Adapt `main.py`'s entry point signature.** For background functions, it's typically `def main(event, context):`. The `event` and `context` parameters are specific to the GCP trigger type (e.g., `event` for GCS contains GCS object metadata; `context` for background functions is `google.cloud.functions.Context`).
     - Update the `gcloud functions deploy` command with the correct `--trigger-...` flags (e.g., `--trigger-bucket`, `--trigger-topic`, `--trigger-event`).

### 6. Handle AWS Lambda Layers
"""
        if lambda_layers:
            readme_content += "   - This Lambda function utilized the following layers:\n"
            for layer in lambda_layers:
                readme_content += f"     - {layer['Arn']}\n"
            readme_content += "   - **Layer code and dependencies ARE NOT automatically downloaded or converted by this script.**\n"
            readme_content += "   - **CRITICAL: You must manually:** \n"
            readme_content += "       1. Identify the contents (code and dependencies) of these layers.\n"
            readme_content += "       2. Integrate their functionality and dependencies directly into the GCP function's `main.py`, other source files, or `requirements.txt`.\n"
            readme_content += "       3. Alternatively, for shared code in GCP, explore options like creating custom packages in Artifact Registry or using private Git repositories.\n"
        else:
            readme_content += "   - No Lambda layers were detected for this function.\n"

        readme_content += f"""
### 7. Configure Runtime, Timeout, and Memory in GCP
   - Original AWS Lambda settings: Runtime `{lambda_runtime}`, Timeout `{lambda_timeout}s`, Memory `{lambda_memory}MB`.
   - For GCP, choose a compatible Python runtime (e.g., `python39`, `python310`, `python311`, `python312`).
   - Configure `--timeout` and `--memory` for the GCP function during deployment. GCP has different limits, defaults, and supported values.

### 8. Refactor Code Logic (AWS Service Integrations)
   - **CRITICAL: This is often the most complex manual step.** Any code that directly interacts with AWS services (e.g., S3, DynamoDB, SQS, SNS, other Lambdas, Step Functions using `boto3`) **WILL FAIL** in GCP.
   - **You MUST refactor this code to use Google Cloud client libraries and target equivalent GCP services.**
     - Example (S3 -> GCS): `boto3.client('s3').put_object(...)` -> `google.cloud.storage.Client().bucket(...).blob(...).upload_from_string(...)`
     - Example (SQS -> Pub/Sub): `boto3.client('sqs').send_message(...)` -> `google.cloud.pubsub_v1.PublisherClient().publish(...)`
     - Example (DynamoDB GetItem -> Firestore Get Document): `boto3.client('dynamodb').get_item(TableName='MyTable', Key={{'id': {{'S': 'some_id'}}}})` -> `google.cloud.firestore.Client().collection('MyTable').document('some_id').get()`
     - Example (DynamoDB Scan/Query -> Firestore Query): `boto3.client('dynamodb').scan(TableName='MyTable', FilterExpression='age > :val', ExpressionAttributeValues={{':val': {{'N': '20'}}}})` -> `google.cloud.firestore.Client().collection('MyTable').where(field_path='age', op_string='>', value=20).stream()`

### 9. Check File System Access & Temporary Files
   - AWS Lambda provides `/tmp` (typically 512MB, configurable).
   - GCP Cloud Functions also provide an in-memory file system at `/tmp` (size varies by generation and memory allocation). Ensure your usage is compatible.
   - **Relative Paths & Imports:** If your original Lambda package had a complex directory structure and the handler was in a subdirectory, relative imports in the now top-level `main.py` might need adjustment (e.g., changing `from .mymodule import foo` to `from mymodule import foo` if `mymodule` is also now at the top level, or `from subdir.mymodule import foo` if `subdir` was copied as is).

### 10. Adapt Logging and Error Reporting
   - Standard Python `logging` will generally integrate with Cloud Logging in GCP.
   - Review any custom logging or error reporting mechanisms (e.g., custom CloudWatch metrics, third-party services) and adapt them for GCP (e.g., Cloud Monitoring custom metrics, Error Reporting).

### 11. VPC Peering / Private Network Access
   - If your Lambda was connected to a VPC for accessing private resources, you'll need to configure Serverless VPC Access for your Google Cloud Function to connect to a GCP VPC.

### 12. Thorough Testing
   - **CRITICAL: After making all manual changes, thoroughly test the converted function in the GCP environment with realistic data and trigger scenarios.** Test error paths and edge cases.

This script provides a starting point. Assume significant manual refactoring will be necessary for a successful migration.
"""
        with open(os.path.join(output_path, 'CONVERSION_README.md'), 'w', encoding='utf-8') as f:
            f.write(readme_content)
        logging.info(f"Generated 'CONVERSION_README.md' in '{output_path}' with detailed manual steps and warnings.")

        logging.info(f"[✅] Conversion process completed. Output files are in: {output_path}")
        return True # Indicate success

    except Exception as e:
        logging.error(f"An unexpected error occurred during the conversion process: {e}", exc_info=True)
        return False # Indicate failure

def main():
    # Setup command-line argument parsing
    parser = argparse.ArgumentParser(
        description="Convert an AWS Lambda function's structure for Google Cloud Functions.",
        formatter_class=argparse.RawTextHelpFormatter, # Preserves newlines in epilog for better readability
        epilog="""
LIMITATIONS & IMPORTANT NOTES:
--------------------------------
This tool performs a VERY BASIC structural conversion. It DOES NOT and CANNOT automatically:
  - Convert AWS SDK calls (e.g., boto3) to Google Cloud client library calls. THIS IS MANUAL.
  - Translate IAM roles or permissions. THIS IS MANUAL.
  - Fully adapt event data structures for different triggers (e.g., S3 event vs. GCS event). THIS IS MANUAL.
  - Handle AWS Lambda Layers directly (layer code/dependencies must be manually integrated). THIS IS MANUAL.
  - Guarantee that relative imports within your Lambda package will work without adjustment. REVIEW IMPORTS.
  - Port business logic that is tightly coupled to AWS services or paradigms.

A thorough manual review and significant code modification are ALMOST ALWAYS REQUIRED.
Always consult the 'CONVERSION_README.md' generated in the output directory for critical next steps.

Example Usage:
  python %(prog)s MyAWSLambdaFunctionName --output ./gcp_converted_lambda --region us-east-1 --cleanup
"""
    )
    parser.add_argument(
        "function_name",
        help="Name of the AWS Lambda function to convert."
    )
    parser.add_argument(
        "--output",
        default="gcp_function_output", # Base directory for output
        help="Output directory for the converted GCP function files. (default: gcp_function_output/<function_name>)"
    )
    parser.add_argument(
        "--region",
        default=None, # boto3 will use default region from config or environment variables if None
        help="AWS region of the Lambda function (e.g., us-west-2). If not specified, uses the default from your AWS CLI configuration or environment variables."
    )
    parser.add_argument(
        "--cleanup",
        action="store_true", # If this flag is present, its value is True
        help="Remove the downloaded .zip file and the temporary extracted Lambda code directory (<function_name>_code) after conversion."
    )

    parsed_args = parser.parse_args()

    # If default output path is used, create a subdirectory named after the function for better organization
    output_directory = parsed_args.output
    if parsed_args.output == "gcp_function_output": # Default value was used
        output_directory = os.path.join("gcp_function_output", parsed_args.function_name)
        logging.info(f"Using default base output. Full output directory will be: {os.path.abspath(output_directory)}")


    # Step 1: Download and extract Lambda code and configuration
    lambda_download_info = download_lambda_code(parsed_args.function_name, parsed_args.region)

    if lambda_download_info:
        # Unpack the returned tuple
        extract_path, handler_file_aws, handler_func_aws, runtime_aws, env_vars_aws, layers_aws, timeout_aws, memory_aws = lambda_download_info

        # Step 2: Convert the extracted code to GCP Function structure
        conversion_success = convert_to_gcp_function(
            aws_function_name_for_readme=parsed_args.function_name, # For the README
            extract_path=extract_path,
            output_path=output_directory,
            lambda_handler_file_from_aws=handler_file_aws,
            lambda_handler_function_from_aws=handler_func_aws,
            lambda_runtime=runtime_aws,
            lambda_env_vars=env_vars_aws,
            lambda_layers=layers_aws,
            lambda_timeout=timeout_aws,
            lambda_memory=memory_aws
        )

        if conversion_success:
            # Provide guidance for next steps and a sample deployment command
            logging.info("\n🚀 Next Steps & Deployment Suggestion:")
            logging.info("1. CRITICALLY Review the 'CONVERSION_README.md' in the output directory.")
            logging.info(f"2. Navigate to the output directory: cd \"{os.path.abspath(output_directory)}\"")
            logging.info("3. Manually adapt 'main.py' (especially AWS SDK calls, event/context handling) and 'requirements.txt'.")
            logging.info("4. Configure environment variables, IAM service account, and triggers in GCP for your new function.")

            # Suggest a GCP runtime based on the AWS runtime
            gcp_runtime_map = {
                "python3.7": "python37", # Supported but deprecated in GCP for new functions
                "python3.8": "python38", # Supported but older
                "python3.9": "python39",
                "python3.10": "python310",
                "python3.11": "python311",
                "python3.12": "python312",
            }
            gcp_runtime_suggestion = None
            for aws_rt_prefix, gcp_rt in gcp_runtime_map.items():
                if runtime_aws.startswith(aws_rt_prefix):
                    gcp_runtime_suggestion = gcp_rt
                    break
            if not gcp_runtime_suggestion:
                gcp_runtime_suggestion = "python311" # A recent general default if no match
                logging.warning(f"Could not map AWS runtime '{runtime_aws}' directly. Suggesting GCP runtime '{gcp_runtime_suggestion}'. Please verify compatibility.")

            # Sanitize Lambda function name for GCP (lowercase, hyphens, max 63 chars)
            gcp_function_name = re.sub(r'[^a-z0-9-]', '', parsed_args.function_name.lower().replace('_', '-'))[:63]
            if not gcp_function_name : gcp_function_name = "my-converted-gcp-function" # Fallback name


            logging.info("\nExample GCP deployment command (for HTTP trigger, Gen2 Cloud Function):")
            logging.info("   --- Review and adjust ALL parameters below, especially trigger type, region, and entry-point! ---")
            logging.info(f"   gcloud functions deploy {gcp_function_name} \\")
            logging.info(f"     --gen2 \\") # Or --gen1 if preferred/needed
            logging.info(f"     --runtime {gcp_runtime_suggestion} \\")
            logging.info(f"     --region <YOUR_GCP_REGION> \\") # e.g., us-central1
            logging.info(f"     --source . \\") # Run from within the output directory
            logging.info(f"     --entry-point main \\") # Ensure this matches your function name in main.py
            logging.info(f"     --trigger-http \\") # For HTTP. Change for other triggers (e.g., --trigger-bucket <BUCKET_NAME>, --trigger-topic <TOPIC_NAME>)
            logging.info(f"     --allow-unauthenticated \\") # For public HTTP. For private, use --no-allow-unauthenticated and set IAM invoker permissions.
            logging.info(f"     --memory {memory_aws}MB \\") # Adjust based on GCP supported values & needs
            logging.info(f"     --timeout {timeout_aws}s \\")      # Adjust based on GCP limits & needs
            logging.info(f"     --set-env-vars KEY1=VALUE1,KEY2=VALUE2 \\") # Add your environment variables
            logging.info(f"     --service-account <YOUR_FUNCTION_SERVICE_ACCOUNT_EMAIL>") # Recommended for specific permissions

        # Step 3: Cleanup temporary files if requested
        if parsed_args.cleanup and extract_path: # ensure extract_path was defined (download was successful)
            logging.info("Cleaning up temporary downloaded files...")
            zip_file_to_remove = f"{parsed_args.function_name}.zip"
            if os.path.exists(zip_file_to_remove):
                try:
                    os.remove(zip_file_to_remove)
                    logging.info(f"Removed temporary zip file: {zip_file_to_remove}")
                except OSError as e_remove_zip:
                    logging.warning(f"Could not remove temporary zip file {zip_file_to_remove}: {e_remove_zip}")

            if os.path.exists(extract_path):
                try:
                    shutil.rmtree(extract_path)
                    logging.info(f"Removed temporary extracted code directory: {extract_path}")
                except OSError as e_remove_dir:
                    logging.warning(f"Could not remove temporary extracted code directory {extract_path}: {e_remove_dir}")
    else:
        logging.error(f"Failed to download or process the AWS Lambda function '{parsed_args.function_name}'. Conversion aborted.")
        logging.error("Please check the function name, your AWS credentials, network connectivity, and permissions.")

if __name__ == "__main__":
    main()
