# Multi-Tenant Chatbot MVP Implementation Plan

## Overview
This document outlines the implementation steps to convert the existing single-tenant chatbot into a secure, scalable, multi-tenant architecture where each tenant represents a business client with multiple users. The MVP focuses on security, tenant-specific isolation, and administrative control.

---

## Core Features for MVP

1. **Tenant-Based Isolation**
    - Each business client (tenant) will have its own account with a unique ID.
    - Chat history, users, and knowledge bases will be scoped per account.

2. **User Access Model**
    - Multiple users per account.
    - Users scoped to one and only one account.

3. **Knowledge Base & Model Access**
    - Each account can have multiple knowledge base IDs.
    - Admins can select from any available Bedrock model.

4. **Admin Panel**
    - Super Admin: Create/edit/delete accounts, configure AWS credentials and models.
    - Account Admin: Manage users, view chat history, select model and prompt settings.

5. **Frontend Context Awareness**
    - Frontend is tenant-aware, scoped by either route param (`/app/:accountId`) or token.
    - Loads config dynamically (branding, prompt, model list, etc).

---

## Backend Implementation Steps

### 1. Create `Account`, `KnowledgeBase`, and `User` Models
```ts
Account {
  id: UUID,
  name: string,
  created_at: timestamp,
  updated_at: timestamp
}

KnowledgeBase {
  id: UUID,
  account_id: UUID,
  name: string,
  bedrock_knowledge_base_id: string,
  created_at: timestamp
}

User {
  id: UUID,
  account_id: UUID,
  email: string,
  password_hash: string,
  role: enum("admin", "user"),
  created_at: timestamp
}
```

### 2. Update Chat API to Accept `account_id`
- Modify `/api/chat` to require `account_id` in request body or extract from user token.
- Load knowledge base and system prompt from database based on `account_id`.

### 3. Create Middleware for Tenant Scoping
- Auth middleware extracts `account_id` from token/session.
- Ensures all downstream logic is scoped to `account_id`.

### 4. Create Chat History Table
```ts
ChatSession {
  id: UUID,
  account_id: UUID,
  user_id: UUID,
  knowledge_base_id: UUID,
  messages: JSONB[],
  created_at: timestamp
}
```
- Save all messages per session with tenant isolation.

### 5. Seed Default Models for Admin Use
- Allow tenant admin to select from predefined Bedrock models.
- Store accessible models per account.

---

## Frontend Implementation Steps

### 1. Add Tenant Context Loader
- On app load, read `/app/:accountId` or pull token.
- Load tenant config (name, prompt, model list, etc) from backend.

### 2. Update ChatWindow to Pass `account_id`
- Include `account_id` in every POST to `/api/chat`.

### 3. Update Layout to Reflect Tenant Context
- Header shows account name or logo.
- Styles and prompt pulled from tenant config.

---

## Admin Panel Implementation Steps

### 1. Super Admin Panel (Global)
- Manage tenants (create, update, delete)
- Assign AWS credentials
- Assign and manage knowledge bases and models

### 2. Tenant Admin Panel (Per Account)
- Invite/manage users
- View chat history by user
- Set system prompt
- Choose default model
- Manage multiple knowledge bases

---

## Optional for Later Phases
- Subdomain routing (`tenant.yourdomain.com`)
- SSO integration (OAuth, SAML)
- Billing per tenant
- Tenant-specific AWS credentials + VPC isolation

---

## Security Best Practices
- Validate `account_id` on every backend call.
- Use hashed passwords and JWT tokens.
- Store secrets (e.g., AWS creds) encrypted.
- Limit model access to authorized accounts.

---

## MVP Goals Summary
- ✅ One backend, multi-tenant aware
- ✅ Frontend scoped per tenant
- ✅ Account + User model
- ✅ Chat history isolation
- ✅ Multiple knowledge bases per account
- ✅ Admin panel scaffolded

Let’s implement this iteratively, starting with backend models and API scoping.

