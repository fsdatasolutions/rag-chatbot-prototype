-- AlterTable
ALTER TABLE "KnowledgeBase" ADD COLUMN     "department" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT;

-- CreateTable
CREATE TABLE "UserKnowledgeBase" (
    "userId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserKnowledgeBase_pkey" PRIMARY KEY ("userId","knowledgeBaseId")
);

-- AddForeignKey
ALTER TABLE "UserKnowledgeBase" ADD CONSTRAINT "UserKnowledgeBase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKnowledgeBase" ADD CONSTRAINT "UserKnowledgeBase_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
