/*
  Warnings:

  - You are about to drop the column `accountId` on the `Model` table. All the data in the column will be lost.
  - Added the required column `modelId` to the `Model` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Model" DROP COLUMN "accountId";
ALTER TABLE "Model" ADD COLUMN "modelId" TEXT;

-- Populate modelId values manually based on name or ID
UPDATE "Model" SET "modelId" = 'claude-3.5-sonnet' WHERE "name" = 'Claude 3.5 Sonnet';
UPDATE "Model" SET "modelId" = 'gpt-4-turbo' WHERE "name" = 'GPT-4-turbo';
UPDATE "Model" SET "modelId" = 'gemini-1.5-pro' WHERE "name" = 'Gemini 1.5 Pro';
UPDATE "Model" SET "modelId" = 'llama3-70b-instruct' WHERE "name" = 'LLaMA 3 70B Instruct';
UPDATE "Model" SET "modelId" = 'mistral-7b-instruct' WHERE "name" = 'Mistral 7B Instruct';

-- Now make it NOT NULL
ALTER TABLE "Model" ALTER COLUMN "modelId" SET NOT NULL;

