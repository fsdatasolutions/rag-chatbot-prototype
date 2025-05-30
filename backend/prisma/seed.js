const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    // Hash the password
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the account
    const account = await prisma.account.create({
        data: {
            name: 'Example Client Inc.',
            knowledgeBases: {
                create: [
                    {
                        name: 'Admissions Docs',
                        bedrockKnowledgeBaseId: 'kb-abc123'
                    },
                    {
                        name: 'Financial Aid Info',
                        bedrockKnowledgeBaseId: 'kb-def456'
                    }
                ]
            },
            users: {
                create: [
                    {
                        email: 'admin4@example.com',
                        passwordHash: hashedPassword,
                        role: 'admin'
                    }
                ]
            }
        },
        include: {
            knowledgeBases: true,
            users: true
        }
    });

    console.log('🌱 Seeded account:');
    console.dir(account, { depth: null });

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error('❌ Error during seed:', e);
    prisma.$disconnect();
    process.exit(1);
});