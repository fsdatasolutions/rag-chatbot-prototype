/*
  Warnings:

  - Added the required column `accountId` to the `Model` table without a default value. This is not possible if the table is not empty.

*/
-- Add column but allow NULL for now
ALTER TABLE "Model" ADD COLUMN "accountId" UUID;

-- Populate the column for existing rows
UPDATE "Model" SET "accountId" = '4b6e1b2d-a486-40cb-90c3-54c12b125b78' WHERE "accountId" IS NULL;

-- Make the column NOT NULL afterwards
ALTER TABLE "Model" ALTER COLUMN "accountId" SET NOT NULL;