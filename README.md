# AWS Lambda to Google Cloud Function Converter Script

## 1. Purpose

This Python script assists in the initial structural conversion of an AWS Lambda function (Python runtime) to a Google Cloud Function (Python runtime). It automates the downloading of the Lambda function's code and configuration, and then reorganizes it into a basic GCP Function structure.

**IMPORTANT:** This script performs a _structural_ conversion only. It **does not** automatically convert AWS SDK calls (e.g., `boto3`) to Google Cloud client library calls, translate IAM roles, or adapt complex event trigger logic. Significant manual review and code modification are required after running this script.

## 2. Prerequisites

Before running this script, ensure you have the following:

- **Python 3.x** installed (Python 3.7+ recommended).
- **Required Python Libraries**:
  - `boto3`: The AWS SDK for Python, used to interact with AWS Lambda.
  - `requests`: Used to download the Lambda function code from a pre-signed URL.
    You can install these libraries using pip:
  ```bash
  pip install boto3 requests
  ```
- **AWS CLI Configured**:
  - The script uses `boto3`, which relies on AWS credentials being configured. Ensure your AWS CLI is configured with credentials that have at least the following IAM permissions for the target Lambda function:
    - `lambda:GetFunction` (to retrieve function configuration and code location)
    - Access to the S3 bucket where the Lambda function's code is stored (permissions are usually granted via the pre-signed URL obtained by `lambda:GetFunction`).
  - You can configure your AWS CLI using `aws configure`. Alternatively, ensure your environment is set up for `boto3` to find credentials (e.g., via environment variables or an IAM role if running on EC2).
- **Network Access**: The machine running the script needs internet access to connect to AWS services (AWS Lambda and S3).
- **Write Permissions**: The script needs write permissions in the directory where it's run to create output folders and files.

## 3. How to Run

Save the script as a Python file (e.g., `lambda_to_gcp_converter.py`). You can then run it from your terminal.

### Command Syntax:

```bash
python lambda_to_gcp_converter.py <function_name> [options]
```

## Command-Line Arguments

### `function_name` (Required)

The name or ARN of the AWS Lambda function you want to convert.

### `--output <directory_path>` (Optional)

Specifies the output directory where the converted Google Cloud Function files will be saved.  
**Default:** `gcp_function_output/<function_name>/` (a subdirectory named after your Lambda function within `gcp_function_output` in the current working directory).  
**Example:**

```bash
--output ./my_converted_functions/my_gcp_lambda
```

### `--region <aws_region>` (Optional)

The AWS region where your Lambda function is located (e.g., `us-east-1`, `eu-west-2`).
If not specified, the script will use the default region configured in your AWS CLI profile or environment variables.
**Example:**

```bash
--region ap-south-1
```

### `--cleanup` (Optional)

A flag that, if present, will remove the temporary downloaded Lambda `.zip` file and the temporary extracted code directory (e.g., `<function_name>_code/`) after the conversion process is complete.
**Example:**

```bash
--cleanup
```

---

## Examples

### Basic Conversion (using default output path and AWS region)

```bash
python lambda_to_gcp_converter.py MyLambdaFunction
```

> Output will be in `./gcp_function_output/MyLambdaFunction/`

---

### Specify Output Directory and Region

```bash
python lambda_to_gcp_converter.py MyCriticalLambda --output ./converted_gcp_code --region us-west-2
```

> Output will be in `./converted_gcp_code/`

---

### Specify Region and Cleanup Temporary Files

```bash
python lambda_to_gcp_converter.py AnotherLambda --region eu-central-1 --cleanup
```

> Output will be in `./gcp_function_output/AnotherLambda/`, and temporary files will be deleted

---

## What the Script Does

1. **Fetches Lambda Details**
   Connects to AWS using `boto3` to retrieve:

   - Lambda configuration (handler, runtime, env vars, layers, timeout, memory)
   - Pre-signed URL to download its deployment package

2. **Downloads and Extracts Code**

   - Downloads the Lambda `.zip` package
   - Extracts its contents into a temporary local directory

3. **Structural Conversion**

   - Identifies primary Python handler file and function
   - Creates a `main.py` file for GCP Function
   - Modifies the handler signature from:

     ```python
     def lambda_handler(event, context):
     ```

     to:

     ```python
     def main(request):
     ```

     - Adds comments for manual adaptation

   - Copies all other original Lambda files to the GCP output directory

4. **Handles `requirements.txt`**

   - If present: copied and a warning comment is added
   - If not found: a new `requirements.txt` with placeholder comments is created

5. **Generates `CONVERSION_README.md`**

   - Created in the output directory
   - Provides detailed post-conversion manual instructions/checklist

---

## Output

The script will create an output directory (default or specified via `--output`) containing:

- `main.py`: Converted entry point for the GCP Function
- `requirements.txt`: Dependencies
- Other original Lambda files
- `CONVERSION_README.md`: Manual adaptation checklist and instructions

---

## Important Limitations

> This tool is only a **starting point**. Significant **manual effort** is required.

- ** No Code Logic Conversion:**
  AWS SDK calls (e.g., `boto3`) are not converted to Google Cloud SDKs.

- **❌ No IAM Translation:**
  AWS IAM roles/policies must be manually mapped to GCP IAM permissions.

- **❌ Trigger Adaptation Limited:**
  Only HTTP triggers are prepared. Other triggers (e.g., S3, SQS) require manual adaptation.

- **❌ No Lambda Layer Conversion:**
  Lambda Layers must be manually integrated into GCP.

---

## Troubleshooting Common Issues

| Error                                                         | Cause & Solution                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `botocore.exceptions.NoCredentialsError`                      | AWS credentials not configured. Run `aws configure` or set environment variables. |
| `botocore.exceptions.ClientError (AccessDeniedException)`     | AWS credentials lack required permissions (`lambda:GetFunction`).                 |
| `botocore.exceptions.ClientError (ResourceNotFoundException)` | Invalid function name, region, or function doesn't exist.                         |
| `requests.exceptions.RequestException`                        | Network error while downloading the Lambda package. Check connectivity.           |
| `zipfile.BadZipFile`                                          | The downloaded file is corrupted or not a valid ZIP.                              |
| File/Directory Permission Errors                              | Ensure the script has write permissions in the target directory.                  |

---

```

Let me know if you'd like this saved as a `.md` file or need help formatting it for GitHub, a documentation site, or something else!
```
