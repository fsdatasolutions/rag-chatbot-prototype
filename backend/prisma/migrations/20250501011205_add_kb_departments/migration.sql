/*
  Warnings:

  - The `department` column on the `KnowledgeBase` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `department` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Department" AS ENUM ('Admissions', 'FinancialAid', 'Registrar', 'IT');

-- AlterTable
ALTER TABLE "KnowledgeBase" DROP COLUMN "department",
ADD COLUMN     "department" "Department";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "department",
ADD COLUMN     "department" "Department";
