import base64
import os
import json
import pandas as pd
from google.generativeai import types as genai_types
import google.generativeai as genai
from dotenv import load_dotenv
import concurrent.futures # Added for parallel execution

load_dotenv()  # Load environment variables from .env file if it exists

# --- Gemini API Interaction Function (mostly unchanged) ---
def get_gemini_analysis(file_content_base64, original_file_name_for_prompt="input.js"):
    """
    Calls the Gemini API with the provided file content and returns the
    text response, which is expected to be a JSON string.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # This error will be caught by the calling function if it occurs in a thread
        print(f"Error for {original_file_name_for_prompt}: GEMINI_API_KEY environment variable not set.")
        # Raise an exception to be caught by the thread's error handling
        raise ValueError(f"GEMINI_API_KEY not set for {original_file_name_for_prompt}")


    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini client for {original_file_name_for_prompt}: {e}")
        raise RuntimeError(f"Error initializing Gemini client for {original_file_name_for_prompt}: {e}") from e

    model_name = "gemini-1.5-flash-latest"
    system_instruction_text = """You are an expert Cloud Migration Assistant specializing in serverless functions. Your primary task is to analyze provided AWS Lambda JavaScript code and generate a detailed migration guide for transitioning it to Google Cloud Functions. Your analysis must be based strictly on the provided code and established differences between AWS and Google Cloud services. Do not hallucinate features or migration paths not directly supported by the input.

When a user provides AWS Lambda JavaScript code, you should:

Analyze Core Functionality: Thoroughly understand the purpose and operational logic of the Lambda function based only on the provided code.
Identify AWS Services & Resources:
Detect all AWS services explicitly used (e.g., through SDK calls) or strongly implied by the code structure and naming conventions (e.g., Lambda triggers, DynamoDB via custom wrappers, SNS, IAM roles, CloudWatch Events/EventBridge).
Note any discernible resource configurations like environment variables mentioned in the code.
Map to Google Cloud Equivalents:
Propose the most direct and suitable Google Cloud service equivalents (e.g., Cloud Functions for Lambda, Cloud Scheduler for scheduled triggers, Pub/Sub for SNS, Firestore for DynamoDB-like NoSQL, Cloud IAM for permissions).
Discuss how AWS resource configurations (like environment variables, memory/timeout if inferable) would translate to Google Cloud.
Pinpoint Necessary Code Changes (Crucial and Detailed):
For each necessary modification, you must gather the following details:
File Name: The name of the JavaScript file where the change is needed.
Line Number(s): The specific line number or range (e.g., "10" or "10-12").
Current Code/Value: The exact existing code snippet or a description of the value/logic that needs to be changed.
To Be Changed To (New Code/Value/Logic): The new code snippet, a template for the new code, or a detailed description of what the new code should accomplish (including Google Cloud Client Libraries to use and conceptual logic if a literal replacement is not possible without user-specific info).
Reason: A clear explanation for why this change is necessary (e.g., "due to differences in AWS SNS ARN format vs. Google Cloud Pub/Sub topic identifiers," or "because the AWS SDK vX DynamoDB.DocumentClient().scan() method needs to be replaced with the @google-cloud/firestore library's collection().get() method").
This level of detail applies to, but is not limited to:
The function handler signature/export method.
All interactions with AWS SDKs.
Construction and usage of service-specific identifiers.
Calls to custom modules.
Access to environment variables.
Address Supporting Migration Aspects:
Outline necessary changes to package.json.
Provide high-level guidance on IAM permission mapping.
Briefly mention differences in deployment, logging, and monitoring.
Output Structure and Clarity:
The overall migration guide can be presented in a structured markdown format, including narrative explanations for resource mapping, IAM considerations, deployment, etc.
However, for the detailed list of specific code changes identified in step 4, you MUST provide this information in JSON format. The JSON structure should be an array of objects, where each object represents a single code change and includes the following keys:
fileName: (String) The original name of the file being analyzed (e.g., "dataExporterLambda.js").
lineNumber: (String or Integer, e.g., "10-12" or 10)
currentCode: (String)
changeTo: (String)
reason: (String)
As an alternative if explicitly requested by the user, or if the primary JSON output is not feasible through the current interface, provide the code changes list as a CSV-formatted text block. This block must start with a header row: FileName,LineNumber,CurrentCode,ChangeTo,Reason, followed by data rows. Ensure values containing commas or newlines are appropriately quoted if generating CSV.
Interaction and Adaptation:
If the provided code is critically incomplete for this level of detailed analysis, or if context is ambiguous, ask targeted clarifying questions before proceeding.
If the user subsequently narrows the scope of their request, adapt your output accordingly, drawing from your comprehensive initial understanding but still adhering to the detailed output format (JSON or CSV for code changes) for the requested sections.
Your ultimate goal is to provide a practical, accurate, and ultra-precise guide that empowers the user to understand and execute the necessary modifications for migrating their AWS Lambda function to Google Cloud Functions. The core actionable items related to code modifications should be easily machine-parsable or importable into spreadsheet software."""


    model = genai.GenerativeModel(model_name, system_instruction=system_instruction_text)

    user_prompt_parts = [
        file_content_base64
    ]

    generation_config = genai_types.GenerationConfig(
        response_mime_type="application/json",
    )

    full_response_text = ""
    try:
        response = model.generate_content(
            contents=user_prompt_parts,
            generation_config=generation_config
        )

        if hasattr(response, 'text') and response.text is not None:
            full_response_text = response.text
        elif response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                full_response_text = "".join(
                    part.text for part in candidate.content.parts if hasattr(part, 'text') and part.text is not None
                )

        if not full_response_text.strip() and \
           hasattr(response, 'prompt_feedback') and \
           response.prompt_feedback and \
           response.prompt_feedback.block_reason:
            raise genai_types.generation_types.BlockedPromptException(
                f"Prompt for {original_file_name_for_prompt} was blocked (heuristic: empty response with block reason). Reason: {response.prompt_feedback.block_reason}",
                response=response
            )

    except genai_types.generation_types.BlockedPromptException as e:
        block_reason_detail = "Unknown"
        if hasattr(e, 'response') and e.response and \
           hasattr(e.response, 'prompt_feedback') and e.response.prompt_feedback:
            if hasattr(e.response.prompt_feedback, 'block_reason_message') and e.response.prompt_feedback.block_reason_message:
                block_reason_detail = e.response.prompt_feedback.block_reason_message
            elif hasattr(e.response.prompt_feedback, 'block_reason') and e.response.prompt_feedback.block_reason:
                block_reason_detail = str(e.response.prompt_feedback.block_reason)
        
        # Error message now includes filename context
        print(f"Gemini API Error for {original_file_name_for_prompt} (BlockedPromptException): {e}. Detailed Reason: {block_reason_detail}")
        raise RuntimeError(f"Gemini API request for {original_file_name_for_prompt} failed: Prompt was blocked. Reason: {block_reason_detail}") from e
    except Exception as e:
        print(f"Gemini API Error for {original_file_name_for_prompt}: {type(e).__name__} - {e}")
        raise RuntimeError(f"Gemini API request for {original_file_name_for_prompt} failed: {type(e).__name__} - {e}") from e

    if not full_response_text.strip():
        error_msg = f"Gemini returned an empty response for file '{original_file_name_for_prompt}'. Please check the input or Gemini's status."
        print(f"Warning: {error_msg}")
        raise RuntimeError(error_msg)

    print(f"<<<< DEBUG: Received response from Gemini for {original_file_name_for_prompt}. Length: {len(full_response_text)} <<<<")
    return full_response_text

# --- New function to process a single file ---
def process_single_file(file_processing_args):
    """
    Reads, encodes, and sends a single JS file to Gemini for analysis.
    Returns a list of code changes or an empty list if an error occurs.
    """
    file_path, input_folder_path = file_processing_args # Unpack arguments
    relative_file_path = os.path.relpath(file_path, input_folder_path)
    
    # Adding a print statement here that's less verbose than the one in the loop
    print(f"Starting processing for: {relative_file_path}")

    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        file_content_base64 = base64.b64encode(file_bytes).decode('utf-8')
    except Exception as e:
        print(f"  Error reading or encoding file {relative_file_path}: {e}")
        return [] # Return empty list on error for this file

    # print(f"  Sending {relative_file_path} to Gemini API for analysis...") # This can be verbose in parallel
    try:
        json_response_text = get_gemini_analysis(file_content_base64, relative_file_path)

        if json_response_text:
            # print(f"  Received analysis for {relative_file_path}.") # Verbose
            try:
                changes_for_file = json.loads(json_response_text)
                if isinstance(changes_for_file, list):
                    processed_changes = []
                    for change_item in changes_for_file:
                        if not isinstance(change_item, dict):
                            print(f"  Warning: Item in JSON list for {relative_file_path} is not a dictionary: {change_item}")
                            continue
                        if 'fileName' not in change_item or not change_item['fileName'] or change_item['fileName'] == "input.js":
                            change_item['fileName'] = relative_file_path
                        processed_changes.append(change_item)
                    print(f"  Successfully parsed {len(processed_changes)} changes for {relative_file_path}.")
                    return processed_changes
                else:
                    print(f"  Warning: Parsed JSON for {relative_file_path} is not a list as expected. Type: {type(changes_for_file)}")
                    print(f"  Content (first 100 chars): {json_response_text[:100]}...")
                    return []
            except json.JSONDecodeError as e:
                print(f"  Error decoding JSON response for {relative_file_path}: {e}")
                print(f"  Raw response snippet (first 100 chars): {json_response_text[:100]}...")
                return []
            except Exception as e:
                print(f"  An unexpected error occurred while processing the API response for {relative_file_path}: {e}")
                return []
        else: # Should not happen if get_gemini_analysis raises error on empty
            print(f"  No JSON response text received for {relative_file_path}.")
            return []
            
    except RuntimeError as e: # Catch errors from get_gemini_analysis itself
        # get_gemini_analysis already prints detailed errors
        print(f"  Skipping file {relative_file_path} due to API/processing error: {e}")
        return []
    except Exception as e: # Catch any other unexpected error during the call for this file
        print(f"  An unexpected critical error occurred for {relative_file_path}: {type(e).__name__} - {e}")
        return []


def process_folder(input_folder_path, output_excel_path="gemini_migration_analysis.xlsx"):
    """
    Processes all .js files in the input folder and its subdirectories in parallel,
    sends them to Gemini, and writes the collated analysis to an Excel file.
    """
    all_code_changes = []

    if not os.path.isdir(input_folder_path):
        print(f"Error: Input folder '{input_folder_path}' not found.")
        return

    js_file_args_list = []
    for root_dir, _, files in os.walk(input_folder_path):
        for filename in files:
            if filename.endswith(".js"):
                file_path = os.path.join(root_dir, filename)
                js_file_args_list.append((file_path, input_folder_path)) # Arguments for process_single_file

    if not js_file_args_list:
        print(f"No .js files found in '{input_folder_path}' or its subdirectories.")
        return
    
    print(f"Found {len(js_file_args_list)} JavaScript files to process.")

    # Determine a sensible number of workers
    # Too many workers can overwhelm the API or lead to diminishing returns.
    # Start with a moderate number, e.g., 5-10, or based on CPU cores for I/O bound.
    # For pure I/O, more workers than CPU cores can be beneficial.
    # Let's cap it to avoid issues, e.g. max 10, or slightly more than CPU count.
    num_workers = min(10, (os.cpu_count() or 1) + 4) 
    print(f"Using up to {num_workers} parallel workers.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Using executor.map to process files in parallel
        # process_single_file is expected to handle its own errors and return a list (empty if error)
        results = executor.map(process_single_file, js_file_args_list)
        
        for file_result_list in results:
            if file_result_list: # file_result_list is the list of changes from one file
                all_code_changes.extend(file_result_list)

    if not all_code_changes:
        print("\nNo code changes were identified or successfully processed across all files.")
        return # Exit if no data to save

    print(f"\nCollating all {len(all_code_changes)} identified code changes...")
    df = pd.DataFrame(all_code_changes)

    expected_columns = ["fileName", "lineNumber", "currentCode", "changeTo", "reason"]
    for col in expected_columns:
        if col not in df.columns:
            df[col] = pd.NA

    df = df[expected_columns]

    try:
        df.to_excel(output_excel_path, index=False, engine='openpyxl')
        print(f"\nMigration analysis successfully saved to '{output_excel_path}'")
    except Exception as e:
        print(f"\nError saving data to Excel file '{output_excel_path}': {e}")
        print("Attempting to save as CSV instead...")
        base_name, _ = os.path.splitext(output_excel_path)
        output_csv_path = base_name + ".csv"
        try:
            df.to_csv(output_csv_path, index=False)
            print(f"Migration analysis successfully saved to '{output_csv_path}'")
        except Exception as e_csv:
            print(f"Error saving data to CSV file '{output_csv_path}': {e_csv}")


if __name__ == "__main__":
    # Make sure python-dotenv is installed: pip install python-dotenv
    # Ensure GEMINI_API_KEY is in your .env file or environment
    if not os.getenv("GEMINI_API_KEY"):
        print("CRITICAL: The GEMINI_API_KEY environment variable is not set (or .env file not found/configured).")
        print("Please set it before running the script.")
    else:
        folder_path = input("Enter the path to the folder containing your .js files (will scan recursively): ")
        excel_file_name = input("Enter the desired name for the output Excel file (e.g., analysis.xlsx): ")
        if not excel_file_name.endswith(".xlsx"):
            excel_file_name += ".xlsx"

        process_folder(folder_path, excel_file_name)