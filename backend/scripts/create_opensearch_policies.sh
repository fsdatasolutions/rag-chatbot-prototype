#!/bin/bash

# Variables
REGION="us-west-2"
ENCRYPTION_POLICY_NAME="fsds-rag-encryption-policy"
ACCESS_POLICY_NAME="fsds-rag-access-policy"
ROLE_ARN="arn:aws:iam::181398284671:role/fsdsrag-bedrock-kb-role"

echo "Creating encryption policy..."

aws opensearchserverless create-security-policy \
  --name "$ENCRYPTION_POLICY_NAME" \
  --type encryption \
  --policy '{
    "Rules": [
      {
        "Resource": ["collection/kb-*"],
        "ResourceType": "collection"
      }
    ],
    "AWSOwnedKey": true
  }' \
  --region "$REGION" || echo "Encryption policy creation failed"

echo "Creating access policy..."

aws opensearchserverless create-access-policy \
  --name "$ACCESS_POLICY_NAME" \
  --type data \
  --policy "[
    {
      \"Rules\": [
        {
          \"Resource\": [\"index/kb-*/*\"],
          \"Permission\": [\"aoss:ReadDocument\", \"aoss:WriteDocument\"],
          \"ResourceType\": \"index\"
        },
        {
          \"Resource\": [\"collection/kb-*\"],
          \"Permission\": [\"aoss:DescribeCollectionItems\"],
          \"ResourceType\": \"collection\"
        }
      ],
      \"Principal\": [\"$ROLE_ARN\"]
    }
  ]" \
  --region "$REGION" || echo "Access policy creation failed"