// scripts/truncate.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ChatMessage",
      "ChatSession",
      "KnowledgeBase",
      "UserKnowledgeBase",
      "User",
      "Department",
      "Account"
    RESTART IDENTITY CASCADE;
  `);
    console.log('✅ All tables truncated');
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());