# Enhancements and Features for Multi-Tenant RAG System

This document outlines recommended enhancements and features for a multi-tenant AI web application that provisions AWS resources for a RAG (Retrieval Augmented Generation) system using AWS Knowledge Base and Bedrock.

## 1. Tenant Isolation & Security

### Resource Encryption
- **KMS Integration**
    - Provision tenant-specific KMS keys for each account
    - Encrypt S3 buckets, OpenSearch collections, and Bedrock knowledge bases
    - Add encryption to data in transit between components

```javascript
// Add to provisionTenantResources.js
const { KMSClient, CreateKeyCommand, CreateAliasCommand } = require('@aws-sdk/client-kms');

// Create tenant-specific KMS key
const kms = new KMSClient({ region: REGION });
const keyResponse = await kms.send(new CreateKeyCommand({
  Description: `Encryption key for tenant ${tenantId}`,
  Tags: createResourceTags(tenantId)
}));

const keyId = keyResponse.KeyMetadata.KeyId;
await kms.send(new CreateAliasCommand({
  AliasName: `alias/fsdsrag-${tenantId}`,
  TargetKeyId: keyId
}));

// Use key for S3 encryption
await s3.send(new PutBucketEncryptionCommand({
  Bucket: bucketName,
  ServerSideEncryptionConfiguration: {
    Rules: [
      {
        ApplyServerSideEncryptionByDefault: {
          SSEAlgorithm: 'aws:kms',
          KMSMasterKeyID: keyId
        },
        BucketKeyEnabled: true
      }
    ]
  }
}));
```

### Network Policies
- **Enhanced VPC Endpoint Policies**
    - Create more restrictive VPC endpoint policies
    - Implement IP-based access control for tenant-specific resources
    - Add resource-based policies for S3 buckets and OpenSearch collections

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-bedrock-kb-role"
      },
      "Action": "aoss:APIAccessAll",
      "Resource": "arn:aws:aoss:${REGION}:${ACCOUNT_ID}:collection/kb-${tenantId}",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/TenantId": "${tenantId}"
        }
      }
    }
  ]
}
```

### IAM Enhancements
- **Tenant-Specific IAM Roles**
    - Create dedicated IAM roles per tenant rather than sharing
    - Implement attribute-based access control (ABAC) using tenant tags
    - Add permission boundaries for tenant-specific roles

```javascript
// Creating tenant-specific IAM role
const { IAMClient, CreateRoleCommand } = require('@aws-sdk/client-iam');
const iam = new IAMClient({ region: REGION });

await iam.send(new CreateRoleCommand({
  RoleName: `fsdsrag-kb-role-${tenantId}`,
  AssumeRolePolicyDocument: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'bedrock.amazonaws.com'
        },
        Action: 'sts:AssumeRole',
        Condition: {
          StringEquals: {
            'aws:ResourceTag/TenantId': tenantId
          }
        }
      }
    ]
  }),
  Tags: createResourceTags(tenantId)
}));
```

## 2. Usage Monitoring & Billing

### Metrics and Monitoring
- **CloudWatch Dashboards**
    - Create per-tenant usage dashboards
    - Track API calls, tokens consumed, storage used, etc.
    - Set up anomaly detection for unusual usage patterns

```javascript
// Creating CloudWatch dashboard for tenant
const { CloudWatchClient, PutDashboardCommand } = require('@aws-sdk/client-cloudwatch');
const cloudwatch = new CloudWatchClient({ region: REGION });

await cloudwatch.send(new PutDashboardCommand({
  DashboardName: `TenantDashboard-${tenantId}`,
  DashboardBody: JSON.stringify({
    widgets: [
      {
        type: 'metric',
        x: 0,
        y: 0,
        width: 12,
        height: 6,
        properties: {
          metrics: [
            ['AWS/Bedrock', 'InvokeModelLatency', 'ModelId', 'anthropic.claude-3-sonnet-20240229-v1:0', 'TenantId', tenantId]
          ],
          view: 'timeSeries',
          stacked: false,
          region: REGION,
          title: 'Bedrock Model Latency'
        }
      }
      // Additional widgets...
    ]
  })
}));
```

### Billing and Budget Management
- **Tenant-Specific Budget Alerts**
    - Create AWS Budgets for each tenant
    - Set up alert thresholds (e.g., 50%, 80%, 90% of quota)
    - Implement automatic throttling or cutoff at limit

```javascript
// Setting up budget alert for tenant
const { BudgetsClient, CreateBudgetCommand } = require('@aws-sdk/client-budgets');
const budgets = new BudgetsClient({ region: REGION });

await budgets.send(new CreateBudgetCommand({
  AccountId: ACCOUNT_ID,
  Budget: {
    BudgetName: `Tenant-${tenantId}-Budget`,
    BudgetType: 'COST',
    TimeUnit: 'MONTHLY',
    BudgetLimit: {
      Amount: '100', // $100 per month
      Unit: 'USD'
    },
    CostFilters: {
      'TagKeyValue': [`user:TenantId$${tenantId}`]
    }
  },
  NotificationsWithSubscribers: [
    {
      Notification: {
        NotificationType: 'ACTUAL',
        ComparisonOperator: 'GREATER_THAN',
        Threshold: 80, // 80% of budget
        ThresholdType: 'PERCENTAGE'
      },
      Subscribers: [
        {
          SubscriptionType: 'EMAIL',
          Address: OWNER_EMAIL
        }
      ]
    }
  ]
}));
```

### Usage Quota Management
- **Tenant-Specific Rate Limiting**
    - Implement application-level rate limiting per tenant
    - Create usage tables in database to track consumption
    - Add throttling mechanisms when quotas are exceeded

```javascript
// Database schema for usage tracking
/* 
CREATE TABLE tenant_usage (
  tenant_id VARCHAR(255),
  date DATE,
  api_calls INT,
  tokens INT,
  storage_bytes BIGINT,
  PRIMARY KEY (tenant_id, date)
);
*/

// Middleware for checking quotas
async function checkTenantQuota(req, res, next) {
  const { tenantId } = req.user;
  const today = new Date().toISOString().split('T')[0];
  
  const usage = await prisma.tenantUsage.findUnique({
    where: { 
      tenantId_date: { 
        tenantId, 
        date: today 
      } 
    }
  });
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { quotaLimit: true }
  });
  
  if (usage && tenant && usage.apiCalls >= tenant.quotaLimit) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please upgrade your plan or try again tomorrow.' 
    });
  }
  
  next();
}
```

## 3. Operational Resilience

### Error Handling and Recovery
- **Dead Letter Queues**
    - Set up SQS queues for failed operations
    - Implement retry logic with exponential backoff
    - Create automated recovery workflows

```javascript
// Setting up Dead Letter Queue
const { SQSClient, CreateQueueCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: REGION });

const dlqResponse = await sqs.send(new CreateQueueCommand({
  QueueName: `kb-ingestion-dlq-${tenantId}`,
  Attributes: {
    MessageRetentionPeriod: '1209600' // 14 days
  },
  tags: createResourceTags(tenantId)
}));

const dlqUrl = dlqResponse.QueueUrl;
const dlqArn = `arn:aws:sqs:${REGION}:${ACCOUNT_ID}:kb-ingestion-dlq-${tenantId}`;

// Main processing queue with DLQ
await sqs.send(new CreateQueueCommand({
  QueueName: `kb-ingestion-queue-${tenantId}`,
  Attributes: {
    RedrivePolicy: JSON.stringify({
      deadLetterTargetArn: dlqArn,
      maxReceiveCount: '5'
    })
  },
  tags: createResourceTags(tenantId)
}));
```

### Health Monitoring
- **System Health Checks**
    - Create health check endpoints for each component
    - Set up automated testing of end-to-end RAG flows
    - Implement proactive monitoring for potential issues

```javascript
// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check S3 access
    await s3.send(new HeadBucketCommand({ Bucket: process.env.SYSTEM_BUCKET }));
    
    // Check Bedrock availability
    await bedrock.send(new ListFoundationModelsCommand({}));
    
    // All checks passed
    res.status(200).json({
      status: 'healthy',
      components: {
        database: 'connected',
        s3: 'accessible',
        bedrock: 'available'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### Backup and Disaster Recovery
- **Automated Backups**
    - Schedule regular backups of tenant data
    - Implement point-in-time recovery for database
    - Create disaster recovery procedures

```javascript
// Setting up S3 replication for disaster recovery
const { PutBucketReplicationCommand } = require('@aws-sdk/client-s3');

await s3.send(new PutBucketReplicationCommand({
  Bucket: bucketName,
  ReplicationConfiguration: {
    Role: `arn:aws:iam::${ACCOUNT_ID}:role/fsdsrag-replication-role`,
    Rules: [
      {
        Id: `${tenantId}-replication-rule`,
        Priority: 1,
        Filter: {
          Prefix: ''
        },
        Status: 'Enabled',
        Destination: {
          Bucket: `arn:aws:s3:::fsdsrag-dr-${REGION}-${tenantId}`,
          StorageClass: 'STANDARD'
        }
      }
    ]
  }
}));
```

## 4. Document Processing Pipeline

### Document Preprocessing
- **Lambda Preprocessors**
    - Create document processing workflows
    - Add document cleaning, validation, and normalization
    - Implement custom chunking strategies

```javascript
// Document preprocessing Lambda
// aws/prepareDocument.js
const { TextractClient, AnalyzeDocumentCommand } = require('@aws-sdk/client-textract');
const textract = new TextractClient({ region: REGION });

async function extractText(s3Bucket, s3Key) {
  const response = await textract.send(new AnalyzeDocumentCommand({
    Document: {
      S3Object: {
        Bucket: s3Bucket,
        Name: s3Key
      }
    },
    FeatureTypes: ['TABLES', 'FORMS']
  }));
  
  // Process and structure the extracted text
  // ...
  
  return structuredText;
}

// Call from document upload handler
const extractedContent = await extractText(bucketName, s3Key);
await uploadProcessedDocument(bucketName, `processed/${s3Key}`, extractedContent);
```

### Asynchronous Processing
- **Message Queues for Document Processing**
    - Implement SQS queues for document processing
    - Create SNS topics for notifications
    - Add webhook callbacks for long-running processes

```javascript
// Setting up document processing workflow
// aws/documentProcessing.js
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: REGION });

async function queueDocumentForProcessing(tenantId, documentInfo) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: `https://sqs.${REGION}.amazonaws.com/${ACCOUNT_ID}/document-processing-${tenantId}`,
    MessageBody: JSON.stringify({
      tenantId,
      documentId: documentInfo.id,
      s3Location: documentInfo.s3Key,
      timestamp: new Date().toISOString()
    }),
    MessageAttributes: {
      'DocumentType': {
        DataType: 'String',
        StringValue: documentInfo.fileType
      }
    }
  }));
}
```

### Document Validation
- **Validation and Quality Control**
    - Add document schema validation
    - Implement content quality checks
    - Create automated virus/malware scanning

```javascript
// Document validation middleware
// middleware/validateDocument.js
const validateDocument = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  for (const file of req.files) {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: `File type ${file.mimetype} not allowed. Please upload PDF, TXT, or MD files only.` 
      });
    }
    
    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({ 
        error: `File too large. Maximum allowed size is 50MB.` 
      });
    }
    
    // Additional validation...
  }
  
  next();
};
```

## 5. Administrative Features

### Tenant Management
- **Provisioning Status Tracking**
    - Add provisioning status to tenant records
    - Implement event-driven status updates
    - Create admin dashboard for monitoring

```javascript
// Update to schema.prisma
/*
model Account {
  id                    String          @id @default(uuid())
  name                  String
  s3Bucket              String?
  vectorStoreArn        String?
  collectionEndpoint    String?
  provisioningStatus    ProvisioningStatus @default(IN_PROGRESS)
  provisioningStartedAt DateTime        @default(now())
  provisioningCompletedAt DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  knowledgeBases        KnowledgeBase[]
  users                 User[]
  // other fields...
}

enum ProvisioningStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
  DEPROVISIONING
  DEPROVISIONED
}
*/

// Update provisioning status
async function updateProvisioningStatus(accountId, status, error = null) {
  const data = {
    provisioningStatus: status
  };
  
  if (status === 'COMPLETED') {
    data.provisioningCompletedAt = new Date();
  }
  
  if (error) {
    data.provisioningError = error.message;
  }
  
  await prisma.account.update({
    where: { id: accountId },
    data
  });
}
```

### Resource Cleanup
- **Tenant Offboarding**
    - Create comprehensive cleanup procedures
    - Implement soft-delete with recovery window
    - Add resource tracking for cleanup verification

```javascript
// Offboarding a tenant
async function deprovisionTenant(accountId) {
  // Update account status
  await prisma.account.update({
    where: { id: accountId },
    data: { provisioningStatus: 'DEPROVISIONING' }
  });
  
  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { knowledgeBases: true }
    });
    
    // Delete all knowledge bases
    for (const kb of account.knowledgeBases) {
      if (kb.bedrockKnowledgeBaseId) {
        await deleteKnowledgeBase(kb.bedrockKnowledgeBaseId);
      }
    }
    
    // Delete OpenSearch collection
    if (account.vectorStoreArn) {
      const collectionName = account.vectorStoreArn.split('/').pop();
      await deleteOpenSearchCollection(collectionName);
    }
    
    // Empty and delete S3 bucket
    if (account.s3Bucket) {
      await emptyS3Bucket(account.s3Bucket);
      await s3.send(new DeleteBucketCommand({
        Bucket: account.s3Bucket
      }));
    }
    
    // Update account status
    await prisma.account.update({
      where: { id: accountId },
      data: { 
        provisioningStatus: 'DEPROVISIONED',
        s3Bucket: null,
        vectorStoreArn: null,
        collectionEndpoint: null
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Failed to deprovision tenant ${accountId}:`, error);
    
    // Update account status to failed
    await prisma.account.update({
      where: { id: accountId },
      data: { 
        provisioningStatus: 'FAILED',
        provisioningError: error.message
      }
    });
    
    throw error;
  }
}
```

### Event Hooks
- **Notification System**
    - Implement webhook notifications for status changes
    - Create SNS topics for system events
    - Add email notifications for critical events

```javascript
// Event notification system
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const sns = new SNSClient({ region: REGION });

async function notifyEvent(eventType, payload) {
  const topicArn = `arn:aws:sns:${REGION}:${ACCOUNT_ID}:fsdsrag-events`;
  
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(payload),
    MessageAttributes: {
      'EventType': {
        DataType: 'String',
        StringValue: eventType
      },
      'TenantId': {
        DataType: 'String',
        StringValue: payload.tenantId || 'system'
      }
    }
  }));
}

// Use in various places
await notifyEvent('kb_created', { 
  tenantId, 
  knowledgeBaseId: bedrockKnowledgeBaseId,
  timestamp: new Date().toISOString()
});
```

## 6. Performance Optimization

### Vector Search Optimization
- **OpenSearch Tuning**
    - Optimize index settings for vector search
    - Implement caching strategies
    - Add performance monitoring

```javascript
// Enhanced OpenSearch index creation
async function createOptimizedOpenSearchIndex(collectionEndpoint, indexName) {
  const settings = {
    "settings": {
      "index": {
        "knn": true,
        "knn.algo_param.ef_search": 512,
        "number_of_shards": 5,
        "number_of_replicas": 1
      }
    },
    "mappings": {
      "properties": {
        "vector_embedding": {
          "type": "knn_vector",
          "dimension": 1536,
          "method": {
            "name": "hnsw",
            "space_type": "cosinesimil",
            "engine": "nmslib",
            "parameters": {
              "ef_construction": 512,
              "m": 16
            }
          }
        },
        "text_chunk": {
          "type": "text",
          "analyzer": "standard"
        },
        "metadata": {
          "type": "object",
          "dynamic": true
        },
        "chunk_id": {
          "type": "keyword"
        },
        "document_id": {
          "type": "keyword"
        },
        "tenant_id": {
          "type": "keyword"
        }
      }
    }
  };
  
  // Create the index with optimized settings
  // ...
}
```

### Caching Layer
- **Response Caching**
    - Implement Redis caching for frequent queries
    - Add cache invalidation strategies
    - Create tiered caching architecture

```javascript
// Redis caching for query results
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function getCachedResponse(tenantId, query, options = {}) {
  const cacheKey = `rag:${tenantId}:${hash(query)}`;
  const cachedResult = await redis.get(cacheKey);
  
  if (cachedResult) {
    return JSON.parse(cachedResult);
  }
  
  // No cache hit, perform query
  const result = await performRAGQuery(tenantId, query, options);
  
  // Cache the result with TTL
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour TTL
  
  return result;
}
```

## 7. Scalability Enhancements

### Auto-Scaling
- **Dynamic Resource Scaling**
    - Implement auto-scaling for application components
    - Add elastic capacity for API handling
    - Create scaling policies based on usage metrics

```javascript
// Auto-scaling configuration for ECS service
const { ECSClient, UpdateServiceCommand } = require('@aws-sdk/client-ecs');
const ecs = new ECSClient({ region: REGION });

async function adjustServiceCapacity(metrics) {
  const currentLoad = metrics.apiRequestsPerMinute / metrics.instanceCount;
  let desiredCount = metrics.instanceCount;
  
  // Scale up if load is high
  if (currentLoad > 100) {
    desiredCount = Math.min(metrics.instanceCount * 2, 20); // Max 20 instances
  } 
  // Scale down if load is low
  else if (currentLoad < 20 && metrics.instanceCount > 1) {
    desiredCount = Math.max(Math.floor(metrics.instanceCount / 2), 1); // Min 1 instance
  }
  
  if (desiredCount !== metrics.instanceCount) {
    await ecs.send(new UpdateServiceCommand({
      cluster: 'fsdsrag-cluster',
      service: 'fsdsrag-api-service',
      desiredCount
    }));
  }
}
```

### Multi-Region Support
- **Geographic Distribution**
    - Add multi-region deployment support
    - Implement global routing for latency optimization
    - Create cross-region replication for resilience

```javascript
// Multi-region configuration
const PRIMARY_REGION = 'us-west-2';
const SECONDARY_REGIONS = ['us-east-1', 'eu-west-1'];

async function createMultiRegionResources(tenantId, primaryResources) {
  const replicatedResources = {};
  
  for (const region of SECONDARY_REGIONS) {
    // Create region-specific S3 bucket
    const regionalBucketName = `fsdsrag-${region}-${tenantId}`.toLowerCase();
    
    const s3Regional = new S3Client({ region });
    await s3Regional.send(new CreateBucketCommand({
      Bucket: regionalBucketName,
      // Configuration...
    }));
    
    // Set up replication from primary to this region
    // ...
    
    replicatedResources[region] = {
      bucketName: regionalBucketName,
      // Other resources...
    };
  }
  
  return replicatedResources;
}
```

## 8. Future-Proofing Features

### Model Versioning
- **Support for Multiple Model Versions**
    - Add infrastructure for multiple model versions
    - Implement model A/B testing capabilities
    - Create model performance comparison tools

```javascript
// Model version support in database
/*
model BedrockModel {
  id          String   @id @default(uuid())
  modelId     String   // e.g., "anthropic.claude-3-sonnet-20240229-v1:0"
  provider    String   // e.g., "anthropic"
  name        String   // e.g., "Claude 3 Sonnet"
  version     String   // e.g., "20240229-v1:0"
  contextSize Int      // e.g., 200000
  inputPricePerToken Float
  outputPricePerToken Float
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model TenantModelConfig {
  id          String   @id @default(uuid())
  tenantId    String
  modelId     String
  isDefault   Boolean  @default(false)
  maxTokens   Int      @default(8192)
  temperature Float    @default(0.7)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  model       BedrockModel @relation(fields: [modelId], references: [id])
  
  @@unique([tenantId, modelId])
}
*/
```

### API Versioning
- **Versioned API Endpoints**
    - Implement versioned API endpoints
    - Add backward compatibility layers
    - Create deprecation strategy for API changes

```javascript
// API versioning middleware
function apiVersionMiddleware(req, res, next) {
  // Get API version from request
  const apiVersion = req.headers['x-api-version'] || 'v1';
  req.apiVersion = apiVersion;
  
  // Route to appropriate handler based on version
  const handlerMap = {
    'v1': handleV1Request,
    'v2': handleV2Request
  };
  
  const handler = handlerMap[apiVersion] || handlerMap['v1'];
  return handler(req, res, next);
}

// Different handlers for different versions
function handleV1Request(req, res, next) {
  // Legacy handling
  // ...
  next();
}

function handleV2Request(req, res, next) {
  // New features
  // ...
  next();
}
```

## 9. Cost Optimization

### Intelligent Scaling
- **Usage-Based Resource Allocation**
    - Implement cost-optimized scaling based on usage patterns
    - Add time-based scaling (e.g., reduce capacity during off-hours)
    - Create resource hibernation for inactive tenants

```javascript
// Scale resources based on tenant activity
async function optimizeResourcesForInactiveTenants() {
  // Get tenants with no activity in last 30 days
  const inactiveTenants = await prisma.account.findMany({
    where: {
      AND: [
        { provisioningStatus: 'COMPLETED' },
        {
          lastActivityAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          }
        }
      ]
    }
  });
  
  for (const tenant of inactiveTenants) {
    // Archive tenant data to cheaper storage
    await archiveTenantData(tenant.id);
    
    // Hibernate OpenSearch collection
    if (tenant.vectorStoreArn) {
      // Scale down collection or implement hibernation strategy
    }
    
    // Update tenant status
    await prisma.account.update({
      where: { id: tenant.id },
      data: { resourceState: 'HIBERNATED' }
    });
  }
}
```

### Lifecycle Management
- **Data Lifecycle Policies**
    - Implement tiered storage strategies
    - Add data archiving for old/unused data
    - Create tenant-specific retention policies

```javascript
// Add lifecycle configuration to S3 buckets
await s3.send(new PutBucketLifecycleConfigurationCommand({
  Bucket: bucketName,
  LifecycleConfiguration: {
    Rules: [
      {
        ID: 'MoveToInfrequentAccess',
        Status: 'Enabled',
        Filter: {
          Prefix: 'kb/'
        },
        Transitions: [
          {
            Days: 90,
            StorageClass: 'STANDARD_IA'
          }
        ]
      },
      {
        ID: 'ArchiveOldData',
        Status: 'Enabled',
        Filter: {
          Prefix: 'kb/'
        },
        Transitions: [
          {
            Days: 365,
            StorageClass: 'GLACIER'
          }
        ]
      }
    ]
  }
}));
```

## 10. Tenant-Specific Customization

### Custom Embeddings
- **Custom Embedding Models**
    - Support for tenant-specific embedding models
    - Add customization of vector dimensions and settings
    - Create benchmarking tools for model selection

```javascript
// Support for tenant-specific embedding models
async function createKnowledgeBaseWithCustomEmbedding(accountId, kbName, embeddingConfig) {
  const account = await prisma.account.findUnique({
    where: { id: accountId }
  });
  
  // Determine model ARN based on tenant preference
  let modelArn = DEFAULT_MODEL_ARN;
  if (embeddingConfig?.modelId) {
    const model = await prisma.embeddingModel.findUnique({
      where: { id: embeddingConfig.modelId }
    });
    if (model) {
      modelArn = model.arn;
    }
  }
  
  // Set vector dimension based on model
  const vectorDimension = embeddingConfig?.dimension || 1536;
  
  // Create knowledge base with custom embedding configuration
  // ...
}
```

### Customizable Chunking
- **Document Chunking Strategies**
    - Add tenant-specific chunking configurations
    - Implement intelligent chunking strategies
    - Create document-type specific chunking

```javascript
// Tenant-specific chunking strategies
const chunkingStrategies = {
  default: {
    chunkingStrategy: 'FIXED_SIZE',
    fixedSizeChunkingConfiguration: {
      maxTokens: 300,
      overlapPercentage: 10
    }
  },
  legal: {
    chunkingStrategy: 'FIXED_SIZE',
    fixedSizeChunkingConfiguration: {
      maxTokens: 500,
      overlapPercentage: 15
    }
  },
  technical: {
    chunkingStrategy: 'FIXED_SIZE',
    fixedSizeChunkingConfiguration: {
      maxTokens: 250,
      overlapPercentage: 5
    }
  }
};

// Use in knowledge base creation
const tenant = await prisma.account.findUnique({
  where: { id: accountId },
  select: { chunkingStrategyType: true }
});

const chunkingConfig = chunkingStrategies[tenant.chunkingStrategyType || 'default'];
```

## Implementation Roadmap

1. **Phase 1: Core Infrastructure**
    - Tenant isolation and security
    - Basic monitoring
    - Error handling and recovery

2. **Phase 2: Operational Excellence**
    - Enhanced monitoring and alerting
    - Document processing pipeline
    - Administrative features

3. **Phase 3: Optimization**
    - Performance optimization
    - Cost optimization
    - Multi-region support

4. **Phase 4: Advanced Features**
    - Custom embeddings
    - Versioning support
    - Tenant-specific customization

## Conclusion

This document outlines a comprehensive set of enhancements for a multi-tenant RAG system using AWS Knowledge Base and Bedrock. By implementing these features, you'll create a secure, scalable, and robust platform that can handle the diverse needs of multiple tenants while maintaining operational efficiency and cost-effectiveness.

The most critical aspects to focus on initially are:

1. **Tenant isolation and security**
2. **Usage monitoring and billing**
3. **Operational resilience**

These form the foundation for a reliable multi-tenant system and should be prioritized in your implementation roadmap.