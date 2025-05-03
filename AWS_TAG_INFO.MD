# ✅ AWS Account Setup & Tagging Strategy

## 📘 Account Details

* **AWS Account ID:** `181398284671`
* **Account Name:** Full Stack Data Solutions (FSDS)
* **Admin Email:** [aws\_admin@fsdatasolutions.com](mailto:aws_admin@fsdatasolutions.com)

## 🔐 Security Best Practices

* Root account uses MFA (enabled)
* `fsds-admin` IAM user or role created with AdministratorAccess
* IAM roles will be used for tenant access isolation
* Only the admin role should have console access for infrastructure

## ✅ Step 1: Define a Tagging Strategy

To enable cost allocation, access control, and operational visibility, we’ll use a consistent tagging strategy for all AWS resources.

### 🎯 Core Tags

| Tag Key       | Example Value               | Description                                  |
| ------------- | --------------------------- | -------------------------------------------- |
| `TenantId`    | `tenant_abc123`             | Uniquely identifies the tenant               |
| `Project`     | `fsds-rag`                  | The internal name of the application/project |
| `Environment` | `prod`, `dev`, `staging`    | Tracks deployment environment                |
| `Owner`       | `admin@fsdatasolutions.com` | Indicates who owns/created the resource      |

### 🧱 Additional Optional Tags

| Tag Key         | Example Value          | Description                           |
| --------------- | ---------------------- | ------------------------------------- |
| `Team`          | `platform-engineering` | Department or team using the resource |
| `ProvisionedBy` | `cdk`, `terraform`     | Tool that provisioned the resource    |

### 🚨 Tagging Rules

* All resources **must be tagged** with at least `TenantId`, `Project`, and `Environment`.
* Tag enforcement policies will be defined later using AWS Config.

### 🔍 Cost Allocation Setup

* Enable all core tags in **Billing > Cost Allocation Tags**
* Use these tags to analyze costs in **Cost Explorer** or export via **Cost and Usage Report (CUR)**

---

## 🧩 Future Considerations

* Automate tagging through Infrastructure as Code (CDK/Terraform)
* Build dashboards/reports to show per-tenant cost and usage
* Apply tag-based permissions and alerts for spend thresholds

---

## 🏗 Step 2: Establish Infrastructure Structure

### Recommended Shared Architecture Layout

All tenants share the same AWS account but are isolated logically:

* **S3:**

    * `fsdsrag-prod-tenant_abc123-knowledge`
    * Use prefixes to separate tenant data if using shared buckets

* **DynamoDB:**

    * Shared table: `fsdsrag-prod-tenant-data`
    * Use `TenantId` as partition key

* **Lambda:**

    * Shared functions with logic to route per `tenantId`

* **API Gateway + Cognito (optional):**

    * Secure endpoints for multi-tenant interaction
    * Use Cognito user groups mapped to IAM roles per tenant

---

## 📊 Step 3: Enable Cost and Usage Reporting (CUR)

1. Navigate to **Billing > Cost & Usage Reports**
2. Create a new CUR:

    * Name: `FSDS-CUR`
    * Enable resource IDs
    * Include all available tags (including `TenantId`)
    * Set delivery to an S3 bucket (e.g., `fsdsrag-cur-billing-data`)
3. Set up Athena or connect to Snowflake for CUR analytics

**Example Queries in Athena:**

```sql
SELECT
  line_item_resource_id,
  line_item_usage_account_id,
  resource_tags_user_tenantid,
  SUM(line_item_blended_cost) AS cost
FROM "fsdsrag_cur"."billing_data"
WHERE usage_start_date >= date_trunc('month', current_date)
GROUP BY 1, 2, 3
ORDER BY cost DESC;
```

---

## 🔁 Step 4: Bootstrap with AWS CDK (Optional)

Use AWS CDK to automate provisioning of:

* Per-tenant S3 buckets and folder structure
* IAM roles with tenant-specific access policies
* Lambda functions tagged per `TenantId`
* CloudWatch log groups per tenant

**Next:** Provide sample CDK stack file to deploy this structure.
