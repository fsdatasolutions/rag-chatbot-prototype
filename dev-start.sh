#!/bin/bash

# Define role to assume
ROLE_ARN="arn:aws:iam::181398284671:role/fsdsrag-bedrock-kb-role"
SESSION_NAME="fsds-local-test"

# Assume the role using your configured admin profile
ASSUME_OUTPUT=$(aws sts assume-role \
  --role-arn "$ROLE_ARN" \
  --role-session-name "$SESSION_NAME" \
  --profile account_admin \
  --output json)

# Extract credentials
export AWS_ACCESS_KEY_ID=$(echo "$ASSUME_OUTPUT" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$ASSUME_OUTPUT" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$ASSUME_OUTPUT" | jq -r '.Credentials.SessionToken')

# Confirm identity
echo "✅ Using assumed role identity:"
aws sts get-caller-identity

# Start your app
echo "🚀 Starting app with temporary credentials..."
npm start