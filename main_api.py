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
import shutil # For shutil.copyfileobj and shutil.copytree, rmtree
import traceback # For detailed error logging
import uuid # For unique temporary directory names

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
    system_instruction_text = """You are a highly specialized AWS Lambda to Google Cloud Functions Migration Code Analyzer.
Your sole purpose is to analyze AWS Lambda JavaScript code and provide:
1.  A detailed list of specific lines/blocks that must change for Google Cloud Functions.
2.  If changes are needed, the complete refactored JavaScript code.
Your output MUST be a single JSON object.

The JSON object structure MUST be:
{
  "initialAssessment": "String: Your brief assessment of whether the input appears to be an AWS Lambda handler and is suitable for this specialized analysis. If not, clearly state why (e.g., 'Input does not appear to be an AWS Lambda handler.').",
  "codeChanges": [ // Array of objects. This array MUST be empty ([]) if no migration-specific code changes are identified.
    {
      "fileName": "String (e.g., 'index.js' - this should be the original file name you are processing)",
      "lineNumber": "String or Integer (specific line number(s) where the AWS-specific code resides, e.g., '10' or '10-12' or '25,28')",
      "currentCode": "String (A concise quote or accurate description of the specific AWS SDK call, AWS service client initialization, AWS resource identifier pattern, or Lambda environment feature that needs changing)",
      "changeTo": "String (The direct Google Cloud equivalent or migration strategy for the 'currentCode'. E.g., for AWS SDK calls, show the corresponding Google Cloud Client Library call/method. For 'require' statements, show the GCP equivalent 'require' statements. For conceptual changes, provide concise guidance.)",
      "reason": "String (A brief, direct explanation of why this AWS-specific element must change for GCP compatibility, e.g., 'AWS SDK SQS client needs replacement with @google-cloud/pubsub for GCP.')"
    }
    // ... more change objects if any
  ],
  "refactoredFullCode": "String: OPTIONAL. If the 'codeChanges' array is NOT empty (meaning changes were identified), this key MUST contain the complete, refactored JavaScript code for the input file as a single string. This refactored code should incorporate all the necessary modifications you've detailed in 'codeChanges'. If the 'codeChanges' array IS empty (no migration changes needed), you MAY omit this 'refactoredFullCode' key entirely, or you MAY include the original, unmodified code content here. Ensure the JSON remains well-formed."
}

Core Principles for 'codeChanges' Array (ABSOLUTE ADHERENCE REQUIRED):
MIGRATION-CRITICAL CHANGES ONLY: Identify and report in 'codeChanges' only code that MUST change due to incompatibilities between the AWS Lambda environment (including its SDKs and service integration patterns) and the Google Cloud Functions environment (with its SDKs and GCP service integration patterns).
NO ASSUMPTIONS, NO GENERIC CODE ANALYSIS:
Do NOT analyze or report on generic JavaScript (e.g., constants unless they are AWS resource identifiers or configurations directly tied to AWS services, utility functions without AWS SDK calls, standard language features) in the 'codeChanges' array.
Do NOT analyze or report on third-party libraries (e.g., Moment.js, Lodash) in 'codeChanges' unless their specific usage is to directly interact with or format data for an AWS service in a way that is incompatible with its GCP counterpart.
If a code element is platform-agnostic or its AWS-specific aspect translates seamlessly to GCP without requiring a code modification, it MUST BE IGNORED in your 'codeChanges' array.
SILENCE ON NON-CHANGES in 'codeChanges': The 'codeChanges' array MUST NOT contain any discussion, explanation, or listing of items that were analyzed but found not to require migration-specific changes. If no changes are needed, 'codeChanges' is an empty array.
PRECISION AND CONCISENESS ("Pin-to-Pin") for 'codeChanges' items: All reported information in each 'codeChanges' object must be direct, specific, and free of verbose explanations or redundant details.

Detailed Steps for Analysis (to populate the JSON object):
A. Initial Code Assessment (for 'initialAssessment' field):
   - Confirm if the provided JavaScript code appears to be an AWS Lambda function handler.
   - State your finding in the 'initialAssessment' field. If it's not an AWS Lambda handler or otherwise unsuitable, explain briefly.

B. Migration Analysis & Change Identification (for 'codeChanges' array - Strictly AWS-to-GCP Focus):
   1. Identify Actionable AWS-Specific Code Elements: Scan the AWS Lambda code exclusively for elements that will require modification. This includes:
      - Direct usage of AWS SDK clients and their specific methods.
      - Blocks of 'require' statements for AWS SDKs.
      - Code constructing/relying on AWS-specific resource identifiers (ARNs, specific AWS service endpoints).
      - Usage of AWS Lambda-specific environment variables for AWS service connections/behavior.
      - Usage of the AWS Lambda context object for AWS-specific info.
   2. Determine GCP Equivalent & Confirm Necessity: For each AWS-specific element:
      - Determine its direct Google Cloud service equivalent and the corresponding client library, method, or configuration.
      - Confirm that a code change is unavoidably required for GCP functionality.
   3. Detailing Required Changes (populate 'codeChanges' objects): For each element confirmed in B.2:
      - Create an object with 'fileName', 'lineNumber', 'currentCode', 'changeTo', and 'reason' as defined in the main JSON structure.
      - 'changeTo' should be specific: For SDK calls, show the GCP method. For 'require' blocks (e.g., `const AWS = require('aws-sdk');`), list direct `require('@google-cloud/...')` equivalents and necessary commented guidance (e.g., `const {Storage} = require('@google-cloud/storage'); /* For DynamoDB: Map to Firestore queries */`). For environment variables, show GCP equivalents or explain differences.

C. Refactored Code Generation (for 'refactoredFullCode' field):
   - If, and ONLY IF, your analysis in Section B resulted in a non-empty 'codeChanges' array:
     - Generate the complete, refactored JavaScript code for the input file.
     - This code MUST incorporate all the necessary modifications detailed in the 'codeChanges' array.
     - **Crucially, for each significant change location detailed in the 'codeChanges' array (especially for complex changes or SDK replacements), you MUST insert an explanatory comment in the 'refactoredFullCode' just BEFORE the modified code block or line(s). This comment should be clearly marked (e.g., starting with '// MIGRATION NOTE:') and briefly explain the change, reference the AWS service being replaced, or indicate the nature of the modification. For example:**
       ```javascript
       // MIGRATION NOTE: AWS S3 GetObject call replaced with Google Cloud Storage download method.
       // Original AWS SDK usage was around line [original lineNumber from codeChanges].
       // See analysis report for: [fileName] for more details.
       const [fileContents] = await storage.bucket(bucketName).file(fileName).download();
       ```
     - **Another example for a 'require' change:**
       ```javascript
       // MIGRATION NOTE: Replaced AWS SDK 'require' statement.
       // Original 'currentCode': [currentCode from codeChanges]
       const { Storage } = require('@google-cloud/storage'); // For GCS
       // const { PubSub } = require('@google-cloud/pubsub'); // Example if Pub/Sub also needed
       /* For other services like DynamoDB (to Firestore) or SES (to SendGrid/Nodemailer), further manual refactoring of logic will be required. */
       ```
     - **Ensure these comments are informative, clearly associated with the specific change, and do not break the JavaScript syntax.**
     - Place this complete refactored code, including the explanatory comments at change sites, as a single string in the 'refactoredFullCode' field of the main JSON object.
   - If 'codeChanges' is an empty array (no migration changes identified):
     - You MAY omit the 'refactoredFullCode' key, or you MAY put the original, unmodified code content into this field.
D. Final Review:
   - Before outputting, internally review your generated JSON to ensure:
     - It strictly adheres to the specified JSON object structure.
     - Every object in the 'codeChanges' array represents an unavoidable AWS-to-GCP migration change.
     - All details in 'codeChanges' are "pin-to-pin" accurate and concise.
     - 'refactoredFullCode' (if present) accurately reflects the changes listed in 'codeChanges' and is the complete file content.
     - The 'codeChanges' array is empty if and only if no migration-critical changes were found.
     - The JSON is well-formed and valid.
"""

    model = genai.GenerativeModel(model_name, system_instruction=system_instruction_text)
    user_prompt_parts = [file_content_base64] # The prompt is now just the code
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
            # If the response is empty AND there's a block reason, it's likely a block.
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
        # An empty response might be valid if the model intends to output an empty JSON object (e.g. "{}")
        # or an object with an empty changes list, though the prompt asks for more structure.
        # A truly empty string is more likely an issue.
        error_msg = f"Gemini returned an empty or whitespace-only response for file '{original_file_name_for_prompt}'."
        print(f"Warning: {error_msg}")
        # Let JSON parsing handle if it's not valid JSON. If it's valid empty JSON like "{}", it might be okay.
        # However, our prompt now expects a specific structure, so "{}"" is not ideal.
        # If it's just whitespace, json.loads will fail.
        # If the model truly sends nothing, raise error.
        raise RuntimeError(error_msg)
        
    return full_response_text


def process_single_file(file_processing_args):
    original_js_file_path, extracted_js_root_path, modified_code_output_root_dir = file_processing_args
    relative_file_path = os.path.relpath(original_js_file_path, extracted_js_root_path)
    path_to_js_file_for_modification = os.path.join(modified_code_output_root_dir, relative_file_path)

    print(f"Processing: {relative_file_path}")
    try:
        with open(original_js_file_path, "rb") as f: # Read from original for analysis
            file_bytes = f.read()
        # It's important that the base64 content is just the file, not a dict.
        file_content_base64 = base64.b64encode(file_bytes).decode('utf-8')

    except Exception as e:
        print(f"  Error reading/encoding {relative_file_path} from original source: {e}")
        return [] # Return empty list for report items on error

    processed_changes_for_report = []
    try:
        json_response_text = get_gemini_analysis(file_content_base64, relative_file_path)
        if not json_response_text:
            print(f"  No JSON response text received for {relative_file_path}.")
            return []

        parsed_response_object = json.loads(json_response_text) # Expecting a dictionary

        initial_assessment = parsed_response_object.get("initialAssessment")
        if initial_assessment:
            print(f"  Model Assessment for {relative_file_path}: {initial_assessment}")

        gemini_changes_list = parsed_response_object.get("codeChanges", [])

        if not isinstance(gemini_changes_list, list):
            print(f"  Warning: 'codeChanges' in response for {relative_file_path} is not a list. Actual type: {type(gemini_changes_list)}")
            gemini_changes_list = [] # Treat as no changes for safety

        for change_item in gemini_changes_list:
            if isinstance(change_item, dict):
                change_item['fileName'] = relative_file_path # Ensure fileName is correct for the report
                processed_changes_for_report.append(change_item)
            else:
                print(f"  Warning: Item in 'codeChanges' list for {relative_file_path} is not a dictionary: {change_item}")

        if not processed_changes_for_report:
            print(f"  No migration-specific code changes identified by Gemini for {relative_file_path} in 'codeChanges' array.")
        else:
            print(f"  {len(processed_changes_for_report)} migration-specific changes identified by Gemini for {relative_file_path} in 'codeChanges' array.")

        # --- Apply refactored code if provided by Gemini ---
        refactored_code_content = parsed_response_object.get("refactoredFullCode")

        if refactored_code_content and isinstance(refactored_code_content, str):
            if processed_changes_for_report: # Changes were identified, so expect refactored code
                print(f"  Attempting to write LLM-generated refactored code to {path_to_js_file_for_modification}...")
            else: # No changes identified, refactoredFullCode might be original code
                print(f"  'refactoredFullCode' provided, but no changes in 'codeChanges'. Writing this content to {path_to_js_file_for_modification} (may be original code).")
            
            try:
                # Ensure content ends with a newline if it's not empty, for consistency
                if refactored_code_content.strip() and not refactored_code_content.endswith('\n'):
                    refactored_code_content += '\n'
                
                with open(path_to_js_file_for_modification, 'w', encoding='utf-8') as f:
                    f.write(refactored_code_content)
                print(f"  Successfully wrote content from 'refactoredFullCode' for {relative_file_path}.")
            except Exception as e_write:
                print(f"  Error writing LLM-generated 'refactoredFullCode' for {relative_file_path}: {e_write}")
                traceback.print_exc()
                # If writing fails, the original copied file (from shutil.copytree earlier) remains.
        elif not refactored_code_content and processed_changes_for_report:
            print(f"  Warning: LLM identified changes for {relative_file_path} but did NOT provide 'refactoredFullCode'. Original file content will be used.")
        elif not refactored_code_content and not processed_changes_for_report:
             print(f"  No changes identified and no 'refactoredFullCode' provided for {relative_file_path}. Original file content is used.")


        print(f"  OK: Analysis complete for {relative_file_path}.")
        return processed_changes_for_report # Return list of change items for the Excel report

    except json.JSONDecodeError as e:
        print(f"  CRITICAL Error decoding JSON response for {relative_file_path}: {e}")
        print(f"  Raw response snippet (first 300 chars): {json_response_text[:300]}...")
        return [] # Return empty for report on JSON error
    except Exception as e: # Catch other errors during processing this file
        print(f"  Failed processing {relative_file_path} after Gemini call (e.g., response handling, file writing): {e}")
        traceback.print_exc()
        return []


def run_analysis_pipeline(extracted_js_root_path: str, temp_base_for_outputs: str) -> dict | None:
    all_code_changes_for_report = []
    js_file_args_list = []

    # Directory to hold (potentially) modified code, initially a copy of extracted_js_root_path.
    # Using a UUID in the name to avoid conflicts if multiple runs store in the same temp_base_for_outputs
    # (though temp_base_for_outputs itself should be unique per request).
    refactored_code_bundle_dir = os.path.join(temp_base_for_outputs, f"refactored_code_bundle_{uuid.uuid4().hex}")
    
    print(f"Creating directory for refactored code bundle: {refactored_code_bundle_dir}")
    try:
        # Ensure clean state if somehow a dir with this unique name exists
        if os.path.exists(refactored_code_bundle_dir):
            shutil.rmtree(refactored_code_bundle_dir)
        shutil.copytree(extracted_js_root_path, refactored_code_bundle_dir)
        print(f"Copied original extracted content from '{extracted_js_root_path}' to '{refactored_code_bundle_dir}' for modification.")
    except Exception as e_copy:
        print(f"FATAL: Could not copy extracted content to refactored bundle directory: {e_copy}")
        traceback.print_exc()
        if os.path.exists(refactored_code_bundle_dir): # Cleanup if partially created
            try: shutil.rmtree(refactored_code_bundle_dir)
            except Exception as e_clean: print(f"Error cleaning up partially created refactored_code_bundle_dir: {e_clean}")
        return None # Indicate fatal error in pipeline setup


    for root_dir, _, files in os.walk(extracted_js_root_path): # Walk original for paths
        for filename in files:
            if filename.endswith(".js"):
                original_file_path = os.path.join(root_dir, filename)
                js_file_args_list.append((original_file_path, extracted_js_root_path, refactored_code_bundle_dir))
            # Non-JS files are already in refactored_code_bundle_dir due to copytree

    if not js_file_args_list:
        print(f"No .js files found in the extracted content from '{extracted_js_root_path}'.")
        # Still return paths, reports will be empty, refactored_code_path will have non-JS files.
        return { 
            "analysis_report_path": None, 
            "work_item_report_path": None,
            "refactored_code_path": refactored_code_bundle_dir, # Contains original non-JS files
            "has_js_to_process": False # Flag to indicate no JS files were found
        }

    print(f"Found {len(js_file_args_list)} JavaScript files to process from uploaded ZIP.")
    num_workers = min(10, (os.cpu_count() or 2) + 4) # Sensible parallelism
    print(f"Using up to {num_workers} parallel workers for Gemini analysis and code modification.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        # map will preserve order if needed, but we extend a list so order of file processing doesn't strictly matter for the final report list
        results = executor.map(process_single_file, js_file_args_list)
        for single_file_report_items in results: # This is the list of change dicts from process_single_file
            if single_file_report_items: # If the list is not empty
                all_code_changes_for_report.extend(single_file_report_items)

    # After processing all files and attempting modifications in refactored_code_bundle_dir

    if not all_code_changes_for_report: # No changes identified across all JS files
        print("\nNo code changes were identified for reporting from any JavaScript files in the ZIP content.")
        return {
            "analysis_report_path": None, 
            "work_item_report_path": None,
            "refactored_code_path": refactored_code_bundle_dir, # Contains JS files (original or LLM modified if it returned full code even for no changes) + non-JS files
            "has_js_to_process": True # JS files were found and processed, just no changes reported
        }

    print(f"\nCollating all {len(all_code_changes_for_report)} identified code changes for the reports.")
    
    # --- Create First Excel Report (Analysis Report) ---
    df_analysis = pd.DataFrame(all_code_changes_for_report)
    # Ensure all expected columns are present, even if some changes didn't have all fields (should not happen with strict prompt)
    expected_analysis_columns = ["fileName", "lineNumber", "currentCode", "changeTo", "reason"]
    for col in expected_analysis_columns:
        if col not in df_analysis.columns:
            df_analysis[col] = pd.NA # Use pandas NA for missing values
    df_analysis = df_analysis[expected_analysis_columns] # Reorder/select columns

    analysis_excel_path = "" # Initialize to ensure it's defined
    try:
        # Create a temporary file for the analysis Excel report within the specific temp base for outputs
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=temp_base_for_outputs) as tmp_excel_file_obj:
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
    if 'reason' in df_analysis.columns and not df_analysis.empty: # Check df_analysis is not empty
        for reason_text in df_analysis['reason']: # Iterate over the 'reason' column
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
    expected_work_item_columns = ["ID", "Work Item Type", "Title", "Assigned To", "State", "Tags", "Area Path", "Parent", "Parent ID"]
    for col in expected_work_item_columns: # Ensure all columns exist even if no work items
        if col not in df_work_items.columns:
            df_work_items[col] = "" # Default to empty string for consistency
    df_work_items = df_work_items[expected_work_item_columns] # Ensure correct order

    work_items_excel_path = "" # Initialize
    try:
        with tempfile.NamedTemporaryFile(delete=False, mode='w+b', suffix=".xlsx", dir=temp_base_for_outputs) as tmp_excel_file_obj:
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
        "work_item_report_path": work_items_excel_path,
        "refactored_code_path": refactored_code_bundle_dir, # This is the path to the FOLDER
        "has_js_to_process": True # JS files were found and processed
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
def cleanup_temp_resources(*paths_or_dirs_to_clean):
    for path_or_dir in paths_or_dirs_to_clean:
        if path_or_dir and os.path.exists(path_or_dir):
            try:
                if os.path.isfile(path_or_dir):
                    os.remove(path_or_dir)
                    print(f"Cleaned up temporary file: {path_or_dir}")
                elif os.path.isdir(path_or_dir):
                    shutil.rmtree(path_or_dir) # Use shutil.rmtree for directories
                    print(f"Cleaned up temporary directory: {path_or_dir}")
            except OSError as e: 
                print(f"Error cleaning up temporary resource {path_or_dir}: {e}")
            except Exception as e: # Catch any other unexpected errors during cleanup
                print(f"Unexpected error cleaning up temporary resource {path_or_dir}: {e}")


@app.post("/analyze-js-zip/")
async def analyze_javascript_zip_endpoint(file: UploadFile = File(..., description="A ZIP file containing JavaScript (.js) files for analysis.")):
    if not os.getenv("GEMINI_API_KEY"): 
        raise HTTPException(status_code=503, detail="Service unavailable: GEMINI_API_KEY not configured on the server.")

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type or missing filename. Please upload a ZIP file.")

    # Create one main temporary directory for this request. It will be cleaned up automatically.
    with tempfile.TemporaryDirectory(prefix="analyzer_job_") as overall_temp_dir:
        print(f"Created overall temporary directory for this job: {overall_temp_dir}")

        safe_filename = os.path.basename(file.filename) 
        uploaded_zip_path = os.path.join(overall_temp_dir, safe_filename)
        extracted_files_root_dir = os.path.join(overall_temp_dir, "extracted_original_content")
        os.makedirs(extracted_files_root_dir, exist_ok=True)

        # Paths for outputs that might be generated by run_analysis_pipeline
        analysis_report_path = None
        work_item_report_path = None
        refactored_code_bundle_path = None # This will be a DIRECTORY path
        output_zip_to_send_path = None # Path for the final ZIP bundle to be sent to user

        try:
            print(f"Saving uploaded file: {safe_filename} to {uploaded_zip_path}")
            with open(uploaded_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer) 
            
            print(f"Extracting ZIP file to: {extracted_files_root_dir}")
            try:
                with zipfile.ZipFile(uploaded_zip_path, 'r') as zip_ref:
                    # Secure extraction
                    for member in zip_ref.infolist():
                        member_filename = member.filename
                        # Disallow absolute paths and path traversal.
                        if member_filename.startswith('/') or ".." in member_filename:
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' attempts traversal or is absolute.")
                        
                        target_path = os.path.join(extracted_files_root_dir, member_filename)
                        
                        # Redundant check due to the above, but good for defense in depth
                        if not os.path.abspath(target_path).startswith(os.path.abspath(extracted_files_root_dir)):
                            raise HTTPException(status_code=400, detail=f"Invalid path in ZIP: '{member_filename}' resolved outside target directory.")

                        if member.is_dir(): # Check if it's a directory
                             os.makedirs(target_path, exist_ok=True)
                        else: # It's a file
                            # Ensure parent directory exists before extracting file
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with open(target_path, "wb") as outfile:
                                outfile.write(zip_ref.read(member.filename))
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Invalid or corrupted ZIP file.")
            except HTTPException: # Re-raise if it's one of our security HTTPExceptions
                raise
            except Exception as e_zip: # Catch other zipfile or OS errors during extraction
                print(f"ZIP extraction error: {e_zip}")
                traceback.print_exc()
                raise HTTPException(status_code=400, detail=f"Error extracting ZIP file: {str(e_zip)}")

            print("Starting analysis pipeline...")
            # run_analysis_pipeline will now use overall_temp_dir for its own temporary outputs like Excel files
            # and the refactored_code_bundle directory.
            pipeline_results = await run_in_threadpool(
                run_analysis_pipeline, 
                extracted_js_root_path=extracted_files_root_dir,
                temp_base_for_outputs=overall_temp_dir # Pass the main temp dir
            )

            if pipeline_results is None: # Indicates a fatal error during pipeline setup (e.g., copytree failed)
                raise HTTPException(
                    status_code=500,
                    detail="Internal error during analysis pipeline setup."
                )
            
            analysis_report_path = pipeline_results.get("analysis_report_path")
            work_item_report_path = pipeline_results.get("work_item_report_path")
            refactored_code_bundle_path = pipeline_results.get("refactored_code_path") # This is a DIRECTORY

            if not pipeline_results.get("has_js_to_process"):
                # No JS files found. Still, we might have non-JS files in refactored_code_bundle_path.
                # We should still zip up what we have (which would be just the copied non-JS files).
                # Or, decide to send a 404/message. For now, let's package what exists.
                print("No JavaScript files were found in the upload. Reports will not be generated.")
                # Ensure report paths are None if no JS to process / no changes reported.
                if not analysis_report_path and not work_item_report_path:
                     pass # This is expected if no JS or no changes
                else: # This case should ideally not happen if logic is correct
                    print("Warning: Reports exist but has_js_to_process is false or no changes reported.")

            # We must have the refactored_code_bundle_path (even if it only contains non-JS files or unmodified JS)
            if not refactored_code_bundle_path or not os.path.isdir(refactored_code_bundle_path):
                print(f"Error: Refactored code bundle path is missing or not a directory: {refactored_code_bundle_path}")
                raise HTTPException(status_code=500, detail="Internal error: Failed to locate the processed code bundle.")

            # Create a temporary ZIP file (within overall_temp_dir) to bundle outputs
            with tempfile.NamedTemporaryFile(delete=False, suffix=".zip", dir=overall_temp_dir, prefix="analysis_bundle_") as tmp_zip_file_obj:
                output_zip_to_send_path = tmp_zip_file_obj.name
            
            base_name_no_ext = os.path.splitext(safe_filename)[0]
            
            with zipfile.ZipFile(output_zip_to_send_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                # Add reports if they exist
                reports_folder_in_zip = f"analysis_REPORTS_FROM_{base_name_no_ext}"
                if analysis_report_path and os.path.exists(analysis_report_path):
                    zf.write(analysis_report_path, arcname=os.path.join(reports_folder_in_zip, f"analysis_{base_name_no_ext}.xlsx"))
                if work_item_report_path and os.path.exists(work_item_report_path):
                    zf.write(work_item_report_path, arcname=os.path.join(reports_folder_in_zip, f"azureDevops_{base_name_no_ext}.xlsx"))

                # Add the refactored code bundle directory
                # arcname for the root of this bundle in the zip
                code_bundle_arc_root = f"refactored_code_FROM_{base_name_no_ext}"
                for root, _, files_in_bundle in os.walk(refactored_code_bundle_path):
                    for f_in_bundle in files_in_bundle:
                        file_full_path = os.path.join(root, f_in_bundle)
                        # Create relative path within the bundle to preserve structure in ZIP
                        relative_path_in_bundle = os.path.relpath(file_full_path, refactored_code_bundle_path)
                        zf.write(file_full_path, arcname=os.path.join(code_bundle_arc_root, relative_path_in_bundle))
            
            print(f"Bundled reports and refactored code into ZIP: {output_zip_to_send_path}")

            output_zip_filename_for_user = f"analysis_bundle_{base_name_no_ext}.zip"
            
            # The overall_temp_dir and its contents (including output_zip_to_send_path, excel files,
            # extracted_files_root_dir, refactored_code_bundle_path) will be cleaned up
            # when the 'with tempfile.TemporaryDirectory()' block exits.
            # However, FileResponse needs the file to exist when it's sending.
            # So, we use BackgroundTask to clean up THIS SPECIFIC output_zip_to_send_path AFTER response.
            # The rest of overall_temp_dir is handled by its own context manager.
            # This seems slightly off. The entire overall_temp_dir should be cleaned by the BackgroundTask
            # IF FileResponse needs it to exist past the endpoint function's completion.
            # For now, let's assume FileResponse copies it or streams it fast enough.
            # If not, `output_zip_to_send_path` would need to be made outside `overall_temp_dir`
            # and cleaned separately.
            #
            # Correct approach: `overall_temp_dir` will be cleaned by its `with` statement.
            # `FileResponse` might need the file to persist. The `BackgroundTask` is usually for
            # files *created by FileResponse* or files that *FileResponse needs but doesn't own*.
            # Simplest for now: move the final zip OUT of overall_temp_dir before returning,
            # then clean that specific file via BackgroundTask.
            
            final_zip_for_response_außerhalb_temp = os.path.join(tempfile.gettempdir(), f"final_{uuid.uuid4().hex}.zip")
            shutil.move(output_zip_to_send_path, final_zip_for_response_außerhalb_temp)
            output_zip_to_send_path = final_zip_for_response_außerhalb_temp # Update path # Update path

            cleanup_task = BackgroundTask(cleanup_temp_resources, output_zip_to_send_path) # only cleans the final zip
            
            return FileResponse(
                path=output_zip_to_send_path,
                media_type='application/zip',
                filename=output_zip_filename_for_user,
                background=cleanup_task
            )

        except HTTPException: # If it's an HTTPException we raised, re-raise it
            # overall_temp_dir will be cleaned automatically by its 'with' statement
            raise
        except Exception as e: # Catch-all for other unexpected errors
            print(f"An unexpected error occurred during /analyze-js-zip for {file.filename or 'unknown file'}:")
            traceback.print_exc() 
            # overall_temp_dir will be cleaned automatically
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
        # `overall_temp_dir` and all its contents (uploaded_zip_path, extracted_files_root_dir,
        # intermediate excel files, refactored_code_bundle_path, initial output_zip_to_send_path)
        # are automatically cleaned up when the `with tempfile.TemporaryDirectory(overall_temp_dir)` block exits.
        # Only the moved `final_zip_for_response_außerhalb_temp` needs explicit cleanup via BackgroundTask.


@app.get("/", summary="API Root", description="Welcome to the Gemini JS Code Analyzer API.")
async def root():
    return {"message": "Gemini JS Code Analyzer API. Use the /docs endpoint to see API details and test the /analyze-js-zip POST endpoint."}

