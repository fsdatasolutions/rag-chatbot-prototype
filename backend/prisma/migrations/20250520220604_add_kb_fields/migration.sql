-- AlterTable
ALTER TABLE "KnowledgeBase" ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "s3Prefix" TEXT,
ADD COLUMN     "vectorIndexName" TEXT;
