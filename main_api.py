import base64
import os
import json
import pandas as pd
from google.generativeai import types as genai_types
import google.generativeai as genai
from dotenv import load_dotenv
import concurrent.futures
import tempfile
import zipfile
import shutil # For shutil.copyfileobj
import traceback # For detailed error logging

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool # To run sync code in async endpoint
from starlette.background import BackgroundTask # For cleaning up files after response
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware

# Load environment variables from .env file if it exists
load_dotenv()

# --- Gemini API Key Check (Early check at app startup) ---
if not os.getenv("GEMINI_API_KEY"):
    print("CRITICAL STARTUP ERROR: The GEMINI_API_KEY environment variable is not set.")
    print("The API will likely fail for analysis requests. Please set the environment variable.")

# --- Existing Gemini Analysis Functions (with minor context in prints) ---
def get_gemini_analysis(file_content_base64, original_file_name_for_prompt="input.js"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print(f"Error for {original_file_name_for_prompt}: GEMINI_API_KEY environment variable not set during API call.")
        raise ValueError(f"GEMINI_API_KEY not set for {original_file_name_for_prompt}")

    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Gemini client for {original_file_name_for_prompt}: {e}")
        raise RuntimeError(f"Error initializing Gemini client for {original_file_name_for_prompt}") from e

    model_name = "gemini-1.5-flash-latest"
    system_instruction_text = """You are a highly specialized AWS Lambda to Google Cloud Functions Migration Code Analyzer. Your sole purpose is to identify specific lines or blocks of AWS Lambda JavaScript code that must change to function correctly in a Google Cloud Functions environment. You will detail the exact AWS resource/SDK call/configuration and its direct Google Cloud equivalent or migration strategy. Your output of these changes must be in JSON format.

Core Principles: ABSOLUTE ADHERENCE REQUIRED
MIGRATION-CRITICAL CHANGES ONLY: Identify and report only code that must change due to incompatibilities between the AWS Lambda environment (including its SDKs and service integration patterns) and the Google Cloud Functions environment (with its SDKs and GCP service integration patterns).
NO ASSUMPTIONS, NO GENERIC CODE ANALYSIS:
Do NOT analyze or report on generic JavaScript (e.g., constants unless they are AWS resource identifiers or configurations directly tied to AWS services, utility functions without AWS SDK calls, standard language features).
Do NOT analyze or report on third-party libraries (e.g., Moment.js, Lodash) unless their specific usage is to directly interact with or format data for an AWS service in a way that is incompatible with its GCP counterpart.
If a code element is platform-agnostic or its AWS-specific aspect translates seamlessly to GCP without requiring a code modification, it MUST BE IGNORED in your final output.
SILENCE ON NON-CHANGES: Your final output to the user (specifically the JSON list of changes) MUST NOT contain any discussion, explanation, or listing of items that were analyzed but found not to require migration-specific changes.
PRECISION AND CONCISENESS ("Pin-to-Pin"): All reported information must be direct, specific, and free of verbose explanations or redundant details.
A. Initial Code Assessment
Confirm the provided JavaScript code is an AWS Lambda function handler.
If the code does NOT appear to be an AWS Lambda function handler, clearly state that the input is not as expected for this specialized analysis and await further instruction or corrected input.
B. Migration Analysis & Change Identification (Strictly AWS-to-GCP Focus for Lambda Code)
Identify Actionable AWS-Specific Code Elements: Scan the AWS Lambda code exclusively for elements that will require modification due to the AWS-to-GCP platform shift. This includes:
Direct usage of AWS SDK clients and their specific methods (e.g., new S3Client(), s3.getObject(), dynamoDBDocClient.put(), sns.publish()).
Blocks of require statements for AWS SDKs.
Code that constructs or relies on AWS-specific resource identifiers (e.g., ARNs, specific endpoint patterns for AWS services).
Usage of AWS Lambda-specific environment variables that configure connections to AWS services or define AWS-specific behavior (e.g., process.env.regionName if used for AWS SDK client region).
Usage of the AWS Lambda context object for AWS-specific information that has a different structure or handling in Google Cloud Functions.
Determine GCP Equivalent & Confirm Necessity of Change: For each AWS-specific element identified above:
Determine its direct Google Cloud service equivalent and the corresponding client library, method, or configuration pattern.
Confirm that a code change is unavoidably required for functionality in Google Cloud Functions.
Detailing Required Changes (for the JSON output):
For each and every code element that is identified in B.1 and confirmed in B.2 as requiring modification, compile the following precise details:
fileName: The JavaScript file name (e.g., "index.js").
lineNumber: The specific line number(s) where the AWS-specific code resides.
currentCode (AWS Specific Element): A concise string that quotes or accurately describes the specific AWS SDK call, AWS service client initialization (e.g., the block of require statements for AWS SDKs), AWS resource identifier pattern (e.g., process.env.regionName used for AWS SDK region), or Lambda environment feature. This string represents the "AWS side" of the transformation.
changeTo (Direct GCP Counterpart/Strategy): A concise string that provides the direct Google Cloud equivalent or migration strategy specifically for the currentCode identified above. This must be the "GCP side" of the transformation, directly corresponding to the currentCode.
For individual AWS SDK calls, show the corresponding Google Cloud Client Library call/method (e.g., if currentCode is "new SendMessageCommand({...}) with SQS", changeTo should be "Use @google-cloud/pubsub to publish: pubSubClient.topic(topicName).publishJSON({...})").
For blocks of AWS SDK require statements, changeTo should list the direct require('@google-cloud/...') equivalents for mappable services, followed by commented guidance for other services, precisely as demonstrated in user-provided examples (e.g., const {Storage} = require('@google-cloud/storage'); ... // For SES: Use Nodemailer via Cloud Functions; // For DynamoDB: Map to Firestore queries and data model).
For AWS-specific environment variables like process.env.regionName (when used for AWS client config), changeTo should show its GCP equivalent (e.g., process.env.GCP_REGION || 'your-default-gcp-region' or explain that region configuration for GCP clients is often handled differently or implicitly).
For AWS resource identifier patterns, show the corresponding GCP resource identifier pattern or access method.
The content here should directly answer "How do I replace or adapt the currentCode for GCP?" with specific GCP client libraries, methods, or patterns.
reason (Migration Mandate): A brief, direct explanation of why this AWS-specific element must change for GCP compatibility (e.g., "AWS SDK v3 SQS client needs replacement with @google-cloud/pubsub for GCP," "AWS region variable process.env.regionName not standard in GCP; use GCP-specific region config or rely on client defaults," "DynamoDB structure and API differ from Firestore; requires data model and query changes").
C. Output Generation (JSON - Strictly Actionable Changes)
If, after the strict analysis in Section B, no code elements require modification due to the AWS Lambda to Google Cloud Functions migration, your JSON output MUST be an empty array ([]). You may add a single, brief narrative sentence before the JSON output like: "No migration-specific code changes identified requiring modification for Google Cloud Functions."
If changes ARE identified, provide the detailed list compiled in B.3 exclusively in JSON format as an array of objects.
ABSOLUTE RULE: This JSON list MUST ONLY contain items that require a specific code change directly due to the AWS Lambda to Google Cloud Functions migration. No "no change needed" entries. No discussion of generic code. No verbose explanations. Just the precise details of the required transformation.
JSON structure per change:
JSON

[
  {
    "fileName": "String",
    "lineNumber": "String or Integer",
    "currentCode": "String (Precise AWS element identified)",
    "changeTo": "String (Direct GCP equivalent/strategy/guidance)",
    "reason": "String (Concise migration necessity)"
  }
]
CSV Alternative: Do NOT offer or use a CSV alternative unless explicitly requested by the user after you have provided the primary JSON output.
D. Final Review
Before outputting, internally review your generated JSON to ensure every object within the array represents an unavoidable AWS-to-GCP change, that all details are "pin-to-pin" accurate and concise, and that the changeTo field is a direct and specific counterpart or migration strategy for the currentCode field. Ensure no "no change needed" items or verbose commentary has been included in the JSON."""

    model = genai.GenerativeModel(model_name, system_instruction=system_instruction_text)
    user_prompt_parts = [file_content_base64]
    generation_config = genai_types.GenerationConfig(response_mime_type="application/json")

    full_response_text = ""
    try:
        response = model.generate_content(contents=user_prompt_parts, generation_config=generation_config)
        if hasattr(response, 'text') and response.text is not None:
            full_response_text = response.text
        elif response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                full_response_text = "".join(
                    part.text for part in candidate.content.parts if hasattr(part, 'text') and part.text is not None
                )
        if not full_response_text.strip() and hasattr(response, 'prompt_feedback') and \
           response.prompt_feedback and response.prompt_feedback.block_reason:
            raise genai_types.generation_types.BlockedPromptException(
                f"Prompt for {original_file_name_for_prompt} was blocked (heuristic: empty response with block reason). Reason: {response.prompt_feedback.block_reason}",
                response=response
            )
    except genai_types.generation_types.BlockedPromptException as e:
        block_reason_detail = "Unknown"
        if hasattr(e, 'response') and e.response and hasattr(e.response, 'prompt_feedback') and e.response.prompt_feedback:
            if hasattr(e.response.prompt_feedback, 'block_reason_message') and e.response.prompt_feedback.block_reason_message:
                block_reason_detail = e.response.prompt_feedback.block_reason_message
            elif hasattr(e.response.prompt_feedback, 'block_reason') and e.response.prompt_feedback.block_reason:
                block_reason_detail = str(e.response.prompt_feedback.block_reason)
        print(f"Gemini API Error for {original_file_name_for_prompt} (BlockedPromptException). Reason: {block_reason_detail}")
        raise RuntimeError(f"Gemini API request for {original_file_name_for_prompt} failed: Prompt was blocked. Reason: {block_reason_detail}") from e
    except Exception as e:
        print(f"Gemini API Error for {original_file_name_for_prompt}: {type(e).__name__} - {e}")
        traceback.print_exc() # Added for more detail on generic exceptions
        raise RuntimeError(f"Gemini API request for {original_file_name_for_prompt} failed: {type(e).__name__} - {e}") from e

    if not full_response_text.strip():
        error_msg = f"Gemini returned an empty response for file '{original_file_name_for_prompt}'."
        print(f"Warning: {error_msg}")
        # Consider if this should be a more specific custom exception or if RuntimeError is okay
        raise RuntimeError(error_msg)
    return full_response_text


def process_single_file(file_processing_args):
    file_path, input_folder_path_for_relpath = file_processing_args
    relative_file_path = os.path.relpath(file_path, input_folder_path_for_relpath)
    print(f"Processing: {relative_file_path}")
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        file_content_base64 = base64.b64encode(file_bytes).decode('utf-8')
    except Exception as e:
        print(f"  Error reading/encoding {relative_file_path}: {e}")
        return []
    try:
        json_response_text = get_gemini_analysis(file_content_base64, relative_file_path)
        if json_response_text:
            try:
                parsed_data = json.loads(json_response_text)
                changes_list_from_json = []
                summary_text_from_json = None
                if isinstance(parsed_data, list):
                    changes_list_from_json = parsed_data
                elif isinstance(parsed_data, dict):
                    # Handle potential nested structure if model wraps list in a dict
                    changes_list_from_json = parsed_data.get("codeChanges", []) # Default to empty list if key not found
                    summary_text_from_json = parsed_data.get("summary") or \
                                             parsed_data.get("initialCodeAssessment") or \
                                             parsed_data.get("assessment") # Check multiple keys for summary
                    if summary_text_from_json:
                        print(f"  Model Assessment/Summary for {relative_file_path}: {summary_text_from_json}")
                else:
                    # If JSON is valid but not a list or expected dict, log and return empty
                    print(f"  Warning: Parsed JSON for {relative_file_path} is an unexpected JSON type: {type(parsed_data)}")
                    return [] # No processable changes

                # Ensure changes_list_from_json is indeed a list before iterating
                if isinstance(changes_list_from_json, list):
                    processed_changes = []
                    for change_item in changes_list_from_json:
                        if not isinstance(change_item, dict):
                            print(f"  Warning: Item in 'codeChanges' list for {relative_file_path} is not a dictionary: {change_item}")
                            continue # Skip malformed item

                        # MODIFICATION HERE: Always set/override the fileName with the calculated relative_file_path
                        change_item['fileName'] = relative_file_path

                        processed_changes.append(change_item)

                    if summary_text_from_json and not processed_changes: # Log if summary existed but no changes extracted
                        print(f"  Note for {relative_file_path}: Model provided an assessment resulting in no specific code change items.")
                    print(f"  OK: Parsed {len(processed_changes)} specific code change items for {relative_file_path}.")
                    return processed_changes
                else:
                    # This case might occur if parsed_data was a dict but "codeChanges" was not a list
                    print(f"  Warning: The 'codeChanges' part extracted for {relative_file_path} is not a list. Actual type: {type(changes_list_from_json)}")
                    return [] # No processable changes
            except json.JSONDecodeError as e:
                print(f"  Error decoding JSON response for {relative_file_path}: {e}")
                print(f"  Raw response snippet (first 200 chars): {json_response_text[:200]}...")
                return [] # Error in JSON structure
        else: # json_response_text is None or empty
            print(f"  No JSON response text received for {relative_file_path}.")
            return [] # No response to process
    except Exception as e: # Catch exceptions from get_gemini_analysis or other unexpected issues
        print(f"  Failed processing {relative_file_path} during Gemini call or response handling: {e}")
        traceback.print_exc() # Print full traceback for easier debugging
        return [] # Indicate failure for this file

# Modified: Removed temp_storage_for_excel argument
def run_analysis_pipeline(extracted_js_root_path: str) -> str | None:
    all_code_changes = []
    js_file_args_list = []
    for root_dir, _, files in os.walk(extracted_js_root_path):
        for filename in files:
            if filename.endswith(".js"):
                file_path = os.path.join(root_dir, filename)
                js_file_args_list.append((file_path, extracted_js_root_path))

    if not js_file_args_list:
        print(f"No .js files found in the extracted content from '{extracted_js_root_path}'.")
        return None

    print(f"Found {len(js_file_args_list)} JavaScript files to process from uploaded ZIP.")
    num_workers = min(8, (os.cpu_count() or 1) + 4)
    print(f"Using up to {num_workers} parallel workers for Gemini analysis.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        results = executor.map(process_single_file, js_file_args_list)
        for file_result_list in results:
            if file_result_list: # file_result_list is expected to be a list of change dicts
                all_code_changes.extend(file_result_list)

    if not all_code_changes:
        print("\nNo code changes were identified or successfully processed from the ZIP content.")
        return None

    print(f"\nCollating all {len(all_code_changes)} identified code changes for the report.")
    df = pd.DataFrame(all_code_changes)
    # Ensure all expected columns are present, even if empty for some rows
    expected_columns = ["fileName", "lineNumber", "currentCode", "changeTo", "reason"]
    for col in expected_columns:
        if col not in df.columns:
            df[col] = pd.NA # Use pandas NA for missing values
    df = df[expected_columns] # Reorder/select columns

    excel_file_path = "" # Initialize to ensure it's defined in case of early exit from try
    try:
        # Modified: dir=None uses the system's default temporary directory
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=None) as tmp_excel_file_obj:
            excel_file_path = tmp_excel_file_obj.name
        
        df.to_excel(excel_file_path, index=False, engine='openpyxl')
        print(f"Analysis report generated at temporary path: {excel_file_path}")
        return excel_file_path
    except Exception as e:
        print(f"Error generating Excel report with pandas: {e}")
        traceback.print_exc() # Print full traceback
        if os.path.exists(excel_file_path): # Check if file was partially created
             try:
                os.remove(excel_file_path)
                print(f"Cleaned up partially created/failed Excel file: {excel_file_path}")
             except Exception as e_remove:
                print(f"Error cleaning up partially created/failed Excel file {excel_file_path}: {e_remove}")
        raise # Re-raise the exception so FastAPI can catch it as a 500 error

app = FastAPI(title="Gemini JS Code Analyzer API")

# --- CORS Middleware Configuration ---
origins = ["*"] # Allow all origins for simplicity; restrict in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False, # Typically False if allow_origins is "*" without specific URLs
    allow_methods=["GET", "POST", "OPTIONS"], # Allow OPTIONS for preflight requests
    allow_headers=["*"], # Allow all headers, or specify (e.g., ["Content-Type", "Authorization"])
)
# --- End CORS Middleware Configuration ---


@app.post("/analyze-js-zip/")
async def analyze_javascript_zip_endpoint(file: UploadFile = File(..., description="A ZIP file containing JavaScript (.js) files for analysis.")):
    if not os.getenv("GEMINI_API_KEY"): # Check API key at endpoint level too
        raise HTTPException(status_code=503, detail="Service unavailable: GEMINI_API_KEY not configured on the server.")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type or missing filename. Please upload a ZIP file.")

    # This TemporaryDirectory is for the uploaded ZIP and its extracted contents
    with tempfile.TemporaryDirectory() as temp_zip_extraction_dir:
        safe_filename = os.path.basename(file.filename) # Sanitize filename
        uploaded_zip_path = os.path.join(temp_zip_extraction_dir, safe_filename)
        extracted_files_dir = os.path.join(temp_zip_extraction_dir, "extracted_content")
        os.makedirs(extracted_files_dir, exist_ok=True)

        excel_report_path = None # Initialize
        try:
            print(f"Saving uploaded file: {safe_filename} to {uploaded_zip_path}")
            with open(uploaded_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer) # Efficiently copy file object
            
            print(f"Extracting ZIP file to: {extracted_files_dir}")
            try:
                with zipfile.ZipFile(uploaded_zip_path, 'r') as zip_ref:
                    for member in zip_ref.infolist():
                        member_filename = member.filename
                        # Security: Prevent path traversal and absolute paths
                        if member_filename.startswith('/') or ".." in member_filename:
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' attempts traversal or is absolute.")
                        
                        target_path = os.path.join(extracted_files_dir, member_filename)
                        
                        # Security: Ensure resolved path is within the extraction directory
                        if not os.path.abspath(target_path).startswith(os.path.abspath(extracted_files_dir)):
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' resolved outside target directory.")

                        if member.is_dir():
                             os.makedirs(target_path, exist_ok=True)
                        else: # It's a file
                            # Ensure parent directory exists
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with open(target_path, "wb") as outfile:
                                outfile.write(zip_ref.read(member.filename))
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Invalid or corrupted ZIP file.")
            except HTTPException: # Re-raise specific HTTP exceptions
                raise
            except Exception as e_zip: # Catch other zip-related errors
                print(f"ZIP extraction error: {e_zip}")
                traceback.print_exc()
                raise HTTPException(status_code=400, detail=f"Error extracting ZIP file: {str(e_zip)}")

            print("Starting analysis pipeline...")
            # Modified: Call run_analysis_pipeline without temp_storage_for_excel
            # Use run_in_threadpool for synchronous/blocking code
            excel_report_path = await run_in_threadpool(
                run_analysis_pipeline, # The synchronous function
                extracted_js_root_path=extracted_files_dir
            )

            if excel_report_path is None or not os.path.exists(excel_report_path):
                # This could happen if run_analysis_pipeline returned None (e.g., no JS files, or no changes)
                # or if there was an issue creating the file that wasn't caught by run_analysis_pipeline's try-except
                print(f"Error: Excel report path is None or file does not exist after pipeline. Path: {excel_report_path}")
                # Provide a more user-friendly message if no changes were found specifically
                if excel_report_path is None and not js_file_args_list: # js_file_args_list would be out of scope here, need to check based on pipeline output
                     raise HTTPException(status_code=404, detail="No JavaScript files found in the uploaded ZIP or no migration changes identified.")
                else:
                     raise HTTPException(status_code=500, detail="Internal error: Failed to generate or locate the analysis report file.")

            output_filename = f"gemini_analysis_{os.path.splitext(safe_filename)[0]}.xlsx"
            print(f"Sending Excel report: {excel_report_path} as {output_filename}")
            
            # Background task for cleaning up the temporary Excel file after response is sent
            cleanup_task = BackgroundTask(os.remove, excel_report_path)
            
            return FileResponse(
                path=excel_report_path,
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                filename=output_filename,
                background=cleanup_task # Pass the cleanup task here
            )

        except HTTPException: # Re-raise HTTPExceptions to let FastAPI handle them
            raise
        except Exception as e:
            # Catch-all for other unexpected errors during the process
            print(f"An unexpected error occurred during /analyze-js-zip request for {safe_filename}:")
            traceback.print_exc() # Log the full traceback for server-side debugging
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
        # `temp_zip_extraction_dir` and its contents (uploaded_zip_path, extracted_files_dir)
        # are automatically cleaned up when the `with tempfile.TemporaryDirectory()` block exits.
        # The excel_report_path (if created in default temp dir) is cleaned by BackgroundTask.

@app.get("/", summary="API Root", description="Welcome to the Gemini JS Code Analyzer API.")
async def root():
    return {"message": "Gemini JS Code Analyzer API. Use the /docs endpoint to see API details and test the /analyze-js-zip POST endpoint."}

