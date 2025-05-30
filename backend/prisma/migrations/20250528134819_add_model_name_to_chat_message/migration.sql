/*
  Warnings:

  - Made the column `accountId` on table `DepartmentModelAssignment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "modelName" TEXT;

-- AlterTable
ALTER TABLE "DepartmentModelAssignment" ALTER COLUMN "accountId" SET NOT NULL;
