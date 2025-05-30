/*
  Warnings:

  - You are about to drop the column `s3Bucket` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `vectorStoreArn` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `assignedAt` on the `DepartmentModelAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `bedrockKnowledgeBaseId` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `s3Prefix` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `modelId` on the `Model` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerModelId]` on the table `Model` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `role` on the `ChatMessage` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `accountId` to the `DepartmentModelAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalKbId` to the `KnowledgeBase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerModelId` to the `Model` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Create required ENUM
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- Step 2: Drop old foreign keys temporarily to allow alterations
ALTER TABLE "UserKnowledgeBase" DROP CONSTRAINT IF EXISTS "UserKnowledgeBase_userId_fkey";
ALTER TABLE "UserKnowledgeBase" DROP CONSTRAINT IF EXISTS "UserKnowledgeBase_knowledgeBaseId_fkey";

-- Step 3: Update Account schema
ALTER TABLE "Account"
  DROP COLUMN IF EXISTS "s3Bucket",
  DROP COLUMN IF EXISTS "vectorStoreArn",
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "vectorStoreId" TEXT;

-- Step 4: Make role nullable temporarily, then convert
ALTER TABLE "ChatMessage"
  ADD COLUMN "role_temp" "ChatRole";

-- Backfill default "user" role for all existing messages
UPDATE "ChatMessage" SET "role_temp" = 'user';

-- Drop original column and rename
ALTER TABLE "ChatMessage" DROP COLUMN "role";
ALTER TABLE "ChatMessage" RENAME COLUMN "role_temp" TO "role";
ALTER TABLE "ChatMessage" ALTER COLUMN "role" SET NOT NULL;

-- Step 5: Update DepartmentModelAssignment
ALTER TABLE "DepartmentModelAssignment"
  DROP COLUMN IF EXISTS "assignedAt",
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill accountId if needed manually via SQL

-- Step 6: Update KnowledgeBase
ALTER TABLE "KnowledgeBase"
  DROP COLUMN IF EXISTS "bedrockKnowledgeBaseId",
  DROP COLUMN IF EXISTS "s3Prefix",
  ADD COLUMN "externalKbId" TEXT,
  ADD COLUMN "storagePath" TEXT;

-- Backfill a temporary externalKbId for existing rows
UPDATE "KnowledgeBase" SET "externalKbId" = CONCAT('kb-', id) WHERE "externalKbId" IS NULL;

-- Set NOT NULL constraint
ALTER TABLE "KnowledgeBase" ALTER COLUMN "externalKbId" SET NOT NULL;

-- Step 7: Update Model table
ALTER TABLE "Model"
  DROP COLUMN IF EXISTS "modelId",
  ADD COLUMN "providerModelId" TEXT;

-- Backfill temporary values
UPDATE "Model" SET "providerModelId" = LOWER(REPLACE(name, ' ', '-')) || '-' || id WHERE "providerModelId" IS NULL;

-- Set NOT NULL and UNIQUE constraints
ALTER TABLE "Model" ALTER COLUMN "providerModelId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Model_providerModelId_key" ON "Model"("providerModelId");

-- Step 8: Create new UserModelAssignment table
CREATE TABLE IF NOT EXISTS "UserModelAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModelAssignment_pkey" PRIMARY KEY ("id")
);

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS "UserModelAssignment_accountId_idx" ON "UserModelAssignment"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserModelAssignment_userId_modelId_key" ON "UserModelAssignment"("userId", "modelId");
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatMessage_accountId_idx" ON "ChatMessage"("accountId");
CREATE INDEX IF NOT EXISTS "ChatSession_userId_idx" ON "ChatSession"("userId");
CREATE INDEX IF NOT EXISTS "ChatSession_accountId_idx" ON "ChatSession"("accountId");
CREATE INDEX IF NOT EXISTS "DepartmentModelAssignment_accountId_idx" ON "DepartmentModelAssignment"("accountId");

-- Step 10: Restore foreign keys
ALTER TABLE "UserKnowledgeBase"
  ADD CONSTRAINT "UserKnowledgeBase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserKnowledgeBase"
  ADD CONSTRAINT "UserKnowledgeBase_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepartmentModelAssignment"
  ADD CONSTRAINT "DepartmentModelAssignment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserModelAssignment"
  ADD CONSTRAINT "UserModelAssignment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserModelAssignment"
  ADD CONSTRAINT "UserModelAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserModelAssignment"
  ADD CONSTRAINT "UserModelAssignment_modelId_fkey"
  FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;