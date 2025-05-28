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
    system_instruction_text = """You are an expert Cloud Migration Assistant. Your primary task is to analyze AWS Lambda JavaScript function code and generate a detailed migration guide for transitioning it to Google Cloud Functions. Your analysis must be based strictly on the provided Lambda code and established differences between the AWS Lambda and Google Cloud Functions environments, their respective SDKs, and integrated services.

Core Principle: No Assumptions & Strict Migration-Specific Focus

Your entire analysis and output must be based solely on the provided code and documented differences between AWS Lambda/associated AWS services and Google Cloud Functions/associated GCP services.
Do not make assumptions about user intent or business logic beyond what's explicitly shown interacting with AWS services.
Crucially, only identify and report changes that are directly necessitated by the platform shift from AWS to GCP.
Generic JavaScript code (e.g., declaration of constants that are not AWS service identifiers or configurations, utility functions with no AWS SDK calls or AWS-specific environment variable usage, standard language features) should NOT be flagged as requiring a change for this migration.
Common third-party libraries (e.g., Moment.js, Lodash) should NOT be flagged unless their specific usage is to format data for, or interact directly with, an AWS service in a way that is incompatible with its GCP equivalent. Normal usage of such libraries is platform-agnostic.
If an element of the code is platform-agnostic or its AWS-specific aspect (if any) translates seamlessly without code change, it MUST NOT be listed as requiring modification.
A. Initial Code Assessment & Focus Definition:

Verify Code Type: Confirm the provided JavaScript code is an AWS Lambda function handler.
If clearly an AWS Lambda handler, proceed.
If not (e.g., client-side code), clarify with the user, as previously detailed. If confirmed as client-side with a backend migration, narrow scope to direct AWS backend interactions only.
B. Migration Analysis (For AWS Lambda Code or Relevant Cloud-Interacting Parts):

If the code is confirmed as AWS Lambda (or relevant parts of other code as per A.1):

Identify AWS Resource Usage & Lambda-Specific Interactions REQUIRING CHANGE:
Scrutinize the code for interactions with or dependencies on AWS resources or the Lambda environment that will necessitate a change for GCP. This includes direct AWS SDK calls, environment variables uniquely tied to AWS service configurations, hardcoded AWS resource identifiers, critical AWS Lambda context object usage that differs in GCF, or custom utilities that encapsulate such AWS-specific interactions.
Filter out any findings related to generic JavaScript, platform-agnostic libraries, or internal logic not directly tied to an AWS service that requires transformation for GCP.
Map to Google Cloud Function Equivalents (for items requiring change only):
For elements definitively identified as needing change, propose suitable Google Cloud Function features or GCP service equivalents.
Pinpoint Necessary Code Changes (Crucial, Detailed, Concise - for items requiring change only):
For each element that unambiguously requires modification to migrate from AWS Lambda to Google Cloud Functions:
File Name: (e.g., "index.js").
Line Number(s): Specific line or range.
Current Code/Value: The minimal, precise, and directly relevant AWS-specific code snippet or configuration value that needs changing. Avoid including generic surrounding code, repetitive prefixes, or any platform-agnostic parts.
To Be Changed To (New Code/Value/Guidance): The concise and direct GCP-compatible code snippet, template, or clear, well-formatted commented guidance (especially for complex changes like require blocks, as per user's preferred example style). Focus on practical, actionable information.
Reason: A clear, concise, and specific explanation why this particular change is mandated by the AWS Lambda to Google Cloud Function migration.
Address Supporting Migration Aspects (Briefly, only if directly related to actual code changes identified):
Changes to package.json (only if SDKs are being replaced).
High-level IAM considerations (only for new GCP services that code changes will interact with).
C. Output Structure and Clarity:

Start with a brief confirmation of the Code Assessment (A.1).
If, after thorough analysis and strict filtering, absolutely no code elements require modification due to the AWS to GCP migration, clearly state this. The subsequent JSON/CSV output will then be empty.
For the detailed list of specific code items identified in step B.3 that unambiguously require modification, you MUST provide this information in JSON format.
The JSON structure is an array of objects.
ABSOLUTELY CRITICAL AND NON-NEGOTIABLE: This JSON list MUST ONLY contain items that require a specific code change due to the AWS Lambda to Google Cloud Functions migration. Any item analyzed and found not to require a change (e.g., generic constants, platform-agnostic utilities, compatible configurations) MUST BE COMPLETELY OMITTED from this JSON output. The JSON is exclusively for actionable, migration-mandated changes. No "no change needed" entries are allowed.
Each object in the JSON array (representing a required change) includes:
JSON

[
  {
    "fileName": "String",
    "lineNumber": "String or Integer",
    "currentCode": "String", // Clean, minimal, relevant AWS-specific code/value
    "changeTo": "String",    // Clean, direct GCP-compatible code/guidance
    "reason": "String"     // Concise reason for the migration-specific change
  }
]
If no items require changes, this JSON array MUST be empty ([]).
Alternatively, if explicitly requested, provide this strictly filtered list of required changes only as a CSV-formatted text block (Header: FileName,LineNumber,CurrentCode,ChangeTo,Reason). This CSV must also strictly exclude any "no change needed" items.
Other general advice (trigger mapping, etc.) can be concise markdown, separate from the JSON/CSV.
D. Interaction:
* If critical context is missing, ask clarifying questions.

Your ultimate goal is to deliver a highly focused, precise, and actionable guide for migrating AWS Lambda (JavaScript) functions to Google Cloud Functions. The output of specific code changes (JSON/CSV) must be meticulously filtered to include only items that genuinely need to be changed due to the platform migration, and all reported details must be clean, concise, and directly relevant, avoiding any assumptions or commentary on platform-agnostic code."""

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
                        if 'fileName' not in change_item or not change_item['fileName'] or change_item['fileName'] == "input.js":
                            change_item['fileName'] = relative_file_path
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
        return []

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
            if file_result_list: 
                all_code_changes.extend(file_result_list)

    if not all_code_changes:
        print("\nNo code changes were identified or successfully processed from the ZIP content.")
        return None

    print(f"\nCollating all {len(all_code_changes)} identified code changes for the report.")
    df = pd.DataFrame(all_code_changes)
    expected_columns = ["fileName", "lineNumber", "currentCode", "changeTo", "reason"]
    for col in expected_columns:
        if col not in df.columns:
            df[col] = pd.NA
    df = df[expected_columns]

    excel_file_path = "" 
    try:
        # Modified: dir=None uses the system's default temporary directory
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=None) as tmp_excel_file_obj:
            excel_file_path = tmp_excel_file_obj.name
        
        df.to_excel(excel_file_path, index=False, engine='openpyxl')
        print(f"Analysis report generated at temporary path: {excel_file_path}")
        return excel_file_path
    except Exception as e:
        print(f"Error generating Excel report with pandas: {e}")
        traceback.print_exc() 
        if os.path.exists(excel_file_path): 
             try:
                os.remove(excel_file_path)
                print(f"Cleaned up partially created/failed Excel file: {excel_file_path}")
             except Exception as e_remove:
                print(f"Error cleaning up partially created/failed Excel file {excel_file_path}: {e_remove}")
        raise 

app = FastAPI(title="Gemini JS Code Analyzer API")

# --- CORS Middleware Configuration ---
origins = [
    "http://127.0.0.1:5500", # Your frontend origin
    "http://localhost:5500", # Another common way to access local frontend
    # Add other origins if needed, e.g., your deployed frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], # Allow OPTIONS for preflight requests
    allow_headers=["*"], # Allow all headers, or be more specific
)
# --- End CORS Middleware Configuration ---


@app.post("/analyze-js-zip/")
async def analyze_javascript_zip_endpoint(file: UploadFile = File(..., description="A ZIP file containing JavaScript (.js) files for analysis.")):
    if not os.getenv("GEMINI_API_KEY"): 
        raise HTTPException(status_code=503, detail="Service unavailable: GEMINI_API_KEY not configured on the server.")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type or missing filename. Please upload a ZIP file.")

    # This TemporaryDirectory is for the uploaded ZIP and its extracted contents
    with tempfile.TemporaryDirectory() as temp_zip_extraction_dir:
        safe_filename = os.path.basename(file.filename)
        uploaded_zip_path = os.path.join(temp_zip_extraction_dir, safe_filename)
        extracted_files_dir = os.path.join(temp_zip_extraction_dir, "extracted_content")
        os.makedirs(extracted_files_dir, exist_ok=True)

        excel_report_path = None 
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
            # Modified: Call run_analysis_pipeline without temp_storage_for_excel
            excel_report_path = await run_in_threadpool(
                run_analysis_pipeline, 
                extracted_js_root_path=extracted_files_dir
            )

            if excel_report_path is None or not os.path.exists(excel_report_path):
                print(f"Error: Excel report path is None or file does not exist after pipeline. Path: {excel_report_path}")
                raise HTTPException(status_code=500, detail="Internal error: Failed to generate or locate the analysis report file.")

            output_filename = f"gemini_analysis_{os.path.splitext(safe_filename)[0]}.xlsx"
            print(f"Sending Excel report: {excel_report_path} as {output_filename}")
            
            cleanup_task = BackgroundTask(os.remove, excel_report_path)
            
            return FileResponse(
                path=excel_report_path,
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                filename=output_filename,
                background=cleanup_task 
            )

        except HTTPException: 
            raise
        except Exception as e:
            print(f"An unexpected error occurred during /analyze-js-zip request for {safe_filename}:")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
        # `temp_zip_extraction_dir` and its contents (uploaded_zip_path, extracted_files_dir)
        # are automatically cleaned up.
        # The excel_report_path (created in default temp dir) is cleaned by BackgroundTask.

@app.get("/", summary="API Root", description="Welcome to the Gemini JS Code Analyzer API.")
async def root():
    return {"message": "Gemini JS Code Analyzer API. Use the /docs endpoint to see API details and test the /analyze-js-zip POST endpoint."}

# To run this API:
# 1. Save as main_api.py (or any other Python file name).
# 2. Install dependencies: pip install fastapi "uvicorn[standard]" python-multipart pandas openpyxl google-generativeai python-dotenv
# 3. Create a .env file in the same directory with your GEMINI_API_KEY=YOUR_ACTUAL_KEY
# 4. Run with Uvicorn: uvicorn main_api:app --reload
#    (Replace main_api with your actual Python file name if different)
