# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
# Prevents Python from writing pyc files to disc (optional)
ENV PYTHONDONTWRITEBYTECODE 1
# Prevents Python from buffering stdout and stderr (optional)
ENV PYTHONUNBUFFERED 1
# Set the port the application will listen on (Cloud Run injects this, default 8080)
ENV PORT 8080

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be required by some Python packages (e.g., pandas for Excel)
# openpyxl (used by pandas for .xlsx) typically doesn't need extra system libs,
# but if other complex libraries were added, they might.
# For now, this basic set should be fine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Add any system dependencies here if needed in the future
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir: Disables the pip cache, reducing image size
# --upgrade pip: Ensures pip is up-to-date
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy all files from the build context to the /app directory in the image.
# WARNING: This will copy ALL files, including potentially sensitive ones like .env.
# It is STRONGLY RECOMMENDED NOT to copy .env files or other secrets directly into Docker images.
# Instead, use runtime environment variables (e.g., via Cloud Run configuration) for secrets.
# If you must use `COPY . .`, consider using a .dockerignore file to exclude .env and other sensitive files.
COPY . .
# If you have other modules or static files, they will now be copied by the line above.

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run your application
# Uvicorn will listen on 0.0.0.0 to be accessible from outside the container
# The port is taken from the PORT environment variable, which Cloud Run sets.
# Ensure "main_api:app" matches your Python filename and FastAPI app instance name.
# Using the shell form of CMD to allow shell variable substitution for $PORT
CMD uvicorn main_api:app --host 0.0.0.0 --port $PORT
