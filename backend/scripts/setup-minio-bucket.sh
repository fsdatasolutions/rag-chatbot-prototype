#!/bin/bash

# This script assumes MinIO is running and the `mc` CLI is installed
set -e

# Alias name for your local MinIO
ALIAS_NAME="localminio"

# MinIO credentials
ENDPOINT="http://localhost:9000"
ACCESS_KEY="minioadmin"
SECRET_KEY="minioadmin"
BUCKET_NAME="fsds-dev"

# Add or update MinIO alias
mc alias set "$ALIAS_NAME" "$ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY"

# Create the bucket if it doesn't exist
if ! mc ls "$ALIAS_NAME/$BUCKET_NAME" &> /dev/null; then
echo "🪣 Creating bucket: $BUCKET_NAME"
mc mb "$ALIAS_NAME/$BUCKET_NAME"
else
echo "✅ Bucket '$BUCKET_NAME' already exists."
fi
