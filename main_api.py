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

# --- Gemini Analysis Function ---
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

    model_name = "gemini-1.5-flash-latest" # Or your preferred model
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
        traceback.print_exc()
        raise RuntimeError(f"Gemini API request for {original_file_name_for_prompt} failed: {type(e).__name__} - {e}") from e

    if not full_response_text.strip():
        error_msg = f"Gemini returned an empty response for file '{original_file_name_for_prompt}'."
        print(f"Warning: {error_msg}")
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
        return [] # Return empty list on error to be consistent with successful empty results
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
                    changes_list_from_json = parsed_data.get("codeChanges", []) 
                    summary_text_from_json = parsed_data.get("summary") or \
                                             parsed_data.get("initialCodeAssessment") or \
                                             parsed_data.get("assessment") 
                    if summary_text_from_json:
                        print(f"  Model Assessment/Summary for {relative_file_path}: {summary_text_from_json}")
                else:
                    print(f"  Warning: Parsed JSON for {relative_file_path} is an unexpected JSON type: {type(parsed_data)}")
                    return []

                if isinstance(changes_list_from_json, list):
                    processed_changes = []
                    for change_item in changes_list_from_json:
                        if not isinstance(change_item, dict):
                            print(f"  Warning: Item in 'codeChanges' list for {relative_file_path} is not a dictionary: {change_item}")
                            continue 

                        change_item['fileName'] = relative_file_path # Ensure fileName is correct
                        processed_changes.append(change_item)

                    if summary_text_from_json and not processed_changes:
                        print(f"  Note for {relative_file_path}: Model provided an assessment resulting in no specific code change items.")
                    print(f"  OK: Parsed {len(processed_changes)} specific code change items for {relative_file_path}.")
                    return processed_changes
                else:
                    print(f"  Warning: The 'codeChanges' part extracted for {relative_file_path} is not a list. Actual type: {type(changes_list_from_json)}")
                    return []
            except json.JSONDecodeError as e:
                print(f"  Error decoding JSON response for {relative_file_path}: {e}")
                print(f"  Raw response snippet (first 200 chars): {json_response_text[:200]}...")
                return [] 
        else:
            print(f"  No JSON response text received for {relative_file_path}.")
            return [] 
    except Exception as e: 
        print(f"  Failed processing {relative_file_path} during Gemini call or response handling: {e}")
        traceback.print_exc() 
        return []

def run_analysis_pipeline(extracted_js_root_path: str) -> dict | None:
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
    # Adjust num_workers: min(sensible_max, available_cpus + typical_io_threads)
    # os.cpu_count() can return None, so provide a default (e.g., 1 or 2)
    num_workers = min(10, (os.cpu_count() or 2) + 4) 
    print(f"Using up to {num_workers} parallel workers for Gemini analysis.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        results = executor.map(process_single_file, js_file_args_list)
        for file_result_list in results:
            if file_result_list: # file_result_list is expected to be a list of change dicts
                all_code_changes.extend(file_result_list)

    if not all_code_changes:
        print("\nNo code changes were identified or successfully processed from the ZIP content.")
        return None

    print(f"\nCollating all {len(all_code_changes)} identified code changes for the reports.")
    
    # --- Create First Excel Report (Analysis Report) ---
    df_analysis = pd.DataFrame(all_code_changes)
    expected_analysis_columns = ["fileName", "lineNumber", "currentCode", "changeTo", "reason"]
    for col in expected_analysis_columns:
        if col not in df_analysis.columns:
            df_analysis[col] = pd.NA # Use pandas NA for missing values
    df_analysis = df_analysis[expected_analysis_columns] # Reorder/select columns

    analysis_excel_path = "" # Initialize to ensure it's defined
    try:
        # Create a temporary file for the analysis Excel report
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=None) as tmp_excel_file_obj:
            analysis_excel_path = tmp_excel_file_obj.name
        df_analysis.to_excel(analysis_excel_path, index=False, engine='openpyxl')
        print(f"Analysis report generated at temporary path: {analysis_excel_path}")
    except Exception as e:
        print(f"Error generating Analysis Excel report: {e}")
        traceback.print_exc()
        if os.path.exists(analysis_excel_path): # Clean up if partially created
             try: os.remove(analysis_excel_path)
             except Exception as e_rem: print(f"Error cleaning up failed analysis Excel: {e_rem}")
        raise # Re-raise to be caught by the endpoint

    # --- Create Second Excel Report (Work Item Report) ---
    work_item_data = []
    # Ensure 'reason' column exists and DataFrame is not empty before iterating
    if 'reason' in df_analysis.columns and not df_analysis.empty:
        for reason_text in df_analysis['reason']:
            work_item_data.append({
                "ID": "", 
                "Work Item Type": "User Story",
                "Title": str(reason_text) if pd.notna(reason_text) else "N/A - No specific reason provided",
                "Assigned To": "", 
                "State": "New",
                "Tags": "", 
                "Area Path": "PathPromoPlus (NGPS)\\PromoPlus Team", # As requested
                "Parent": "", 
                "Parent ID": "" 
            })
    
    df_work_items = pd.DataFrame(work_item_data)
    # Ensure all columns are present even if work_item_data was empty due to no reasons
    expected_work_item_columns = ["ID", "Work Item Type", "Title", "Assigned To", "State", "Tags", "Area Path", "Parent", "Parent ID"]
    for col in expected_work_item_columns:
        if col not in df_work_items.columns:
            df_work_items[col] = "" # Default to empty string for consistency in Excel
    df_work_items = df_work_items[expected_work_item_columns] # Ensure correct order

    work_items_excel_path = "" # Initialize
    try:
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=None) as tmp_excel_file_obj:
            work_items_excel_path = tmp_excel_file_obj.name
        df_work_items.to_excel(work_items_excel_path, index=False, engine='openpyxl')
        print(f"Work item report generated at temporary path: {work_items_excel_path}")
    except Exception as e:
        print(f"Error generating Work Item Excel report: {e}")
        traceback.print_exc()
        # Clean up both Excel files if the second one fails
        if os.path.exists(analysis_excel_path):
             try: os.remove(analysis_excel_path)
             except Exception as e_rem: print(f"Error cleaning up analysis Excel after work item fail: {e_rem}")
        if os.path.exists(work_items_excel_path):
             try: os.remove(work_items_excel_path)
             except Exception as e_rem: print(f"Error cleaning up failed work item Excel: {e_rem}")
        raise # Re-raise
        
    return {
        "analysis_report_path": analysis_excel_path,
        "work_item_report_path": work_items_excel_path
    }

app = FastAPI(title="Gemini JS Code Analyzer API")

# --- CORS Middleware Configuration ---
origins = ["*"] # Allow all origins for development; restrict in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False, 
    allow_methods=["GET", "POST", "OPTIONS"], 
    allow_headers=["*"], 
)

# --- Helper for Background Cleanup Task ---
def cleanup_temp_files(*paths):
    for path in paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
                print(f"Cleaned up temporary file: {path}")
            except OSError as e: 
                print(f"Error cleaning up temporary file {path}: {e}")
            except Exception as e: 
                print(f"Unexpected error cleaning up temporary file {path}: {e}")


@app.post("/analyze-js-zip/")
async def analyze_javascript_zip_endpoint(file: UploadFile = File(..., description="A ZIP file containing JavaScript (.js) files for analysis.")):
    if not os.getenv("GEMINI_API_KEY"): 
        raise HTTPException(status_code=503, detail="Service unavailable: GEMINI_API_KEY not configured on the server.")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type or missing filename. Please upload a ZIP file.")

    report_paths_dict = None
    analysis_report_path = None # Path for the first Excel file
    work_item_report_path = None # Path for the second Excel file
    output_zip_path = None # Path for the final ZIP bundle

    # This TemporaryDirectory is for the uploaded ZIP and its extracted contents
    with tempfile.TemporaryDirectory() as temp_zip_extraction_dir:
        safe_filename = os.path.basename(file.filename) 
        uploaded_zip_path = os.path.join(temp_zip_extraction_dir, safe_filename)
        extracted_files_dir = os.path.join(temp_zip_extraction_dir, "extracted_content")
        os.makedirs(extracted_files_dir, exist_ok=True)

        try:
            print(f"Saving uploaded file: {safe_filename} to {uploaded_zip_path}")
            with open(uploaded_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer) 
            
            print(f"Extracting ZIP file to: {extracted_files_dir}")
            try:
                with zipfile.ZipFile(uploaded_zip_path, 'r') as zip_ref:
                    for member in zip_ref.infolist():
                        member_filename = member.filename
                        if member_filename.startswith('/') or ".." in member_filename:
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' attempts traversal or is absolute.")
                        
                        target_path = os.path.join(extracted_files_dir, member_filename)
                        
                        if not os.path.abspath(target_path).startswith(os.path.abspath(extracted_files_dir)):
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' resolved outside target directory.")

                        if member.is_dir():
                             os.makedirs(target_path, exist_ok=True)
                        else: 
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with open(target_path, "wb") as outfile:
                                outfile.write(zip_ref.read(member.filename))
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Invalid or corrupted ZIP file.")
            except HTTPException: 
                raise
            except Exception as e_zip: 
                print(f"ZIP extraction error: {e_zip}")
                traceback.print_exc()
                raise HTTPException(status_code=400, detail=f"Error extracting ZIP file: {str(e_zip)}")

            print("Starting analysis pipeline...")
            report_paths_dict = await run_in_threadpool(
                run_analysis_pipeline, 
                extracted_js_root_path=extracted_files_dir
            )

            if report_paths_dict is None:
                # This means run_analysis_pipeline returned None (no JS files or no changes)
                raise HTTPException(
                    status_code=404, # Using 404 for "not found" in terms of processable content
                    detail="No JavaScript files found for analysis, or no migration changes were identified."
                )

            analysis_report_path = report_paths_dict.get("analysis_report_path")
            work_item_report_path = report_paths_dict.get("work_item_report_path")

            if not analysis_report_path or not os.path.exists(analysis_report_path) or \
               not work_item_report_path or not os.path.exists(work_item_report_path):
                print(f"Error: One or both report paths are None or files do not exist after pipeline. Analysis: {analysis_report_path}, Work Items: {work_item_report_path}")
                # This implies an internal error if run_analysis_pipeline was supposed to return valid paths but didn't, or files vanished
                raise HTTPException(status_code=500, detail="Internal error: Failed to generate or locate one or both analysis report files.")

            # Create a temporary ZIP file to bundle the two Excel reports
            # dir=None uses the system's default temporary directory
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip", dir=None) as tmp_zip_file_obj:
                output_zip_path = tmp_zip_file_obj.name
            
            base_name_no_ext = os.path.splitext(safe_filename)[0]
            analysis_excel_in_zip_name = f"analysis_{base_name_no_ext}.xlsx"
            work_items_excel_in_zip_name = f"work_item_import_{base_name_no_ext}.xlsx"
            
            with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(analysis_report_path, arcname=analysis_excel_in_zip_name)
                zf.write(work_item_report_path, arcname=work_items_excel_in_zip_name)
            
            print(f"Bundled reports into ZIP: {output_zip_path}")

            output_zip_filename = f"analysis_bundle_{base_name_no_ext}.zip"
            
            # Background task for cleaning up ALL temporary files after response
            cleanup_task = BackgroundTask(
                cleanup_temp_files, 
                analysis_report_path, 
                work_item_report_path, 
                output_zip_path # Add the final zip to cleanup list
            )
            
            return FileResponse(
                path=output_zip_path,
                media_type='application/zip', # Correct media type for ZIP
                filename=output_zip_filename,
                background=cleanup_task
            )

        except HTTPException: 
            # If an HTTPException occurred, it's already suitable for the client
            # Ensure any partially created temp files (excel reports, output zip) are cleaned
            # temp_zip_extraction_dir is cleaned by its own 'with' statement
            cleanup_temp_files(analysis_report_path, work_item_report_path, output_zip_path)
            raise
        except Exception as e:
            # Catch-all for other unexpected errors during the process
            print(f"An unexpected error occurred during /analyze-js-zip request for {file.filename or 'unknown file'}:")
            traceback.print_exc() 
            # Ensure cleanup on generic exception
            cleanup_temp_files(analysis_report_path, work_item_report_path, output_zip_path)
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
        # `temp_zip_extraction_dir` and its contents (uploaded_zip_path, extracted_files_dir)
        # are automatically cleaned up when the `with tempfile.TemporaryDirectory()` block exits.

@app.get("/", summary="API Root", description="Welcome to the Gemini JS Code Analyzer API.")
async def root():
    return {"message": "Gemini JS Code Analyzer API. Use the /docs endpoint to see API details and test the /analyze-js-zip POST endpoint."}

