const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const prisma = require('../db/prisma');
const formatAndSanitize = require('../utils/formatAndSanitize');
const routeToModel = require('../utils/modelRouter');
const { getRelevantChunks } = require('../utils/rag/getRelevantChunks');
const embedText = require('../utils/rag/embedText');

router.post('/', authenticateToken, async (req, res) => {
    let { query, modelId, sessionId, knowledgeBaseId = 'none' } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing query' });
    }

    try {
        // 1. Determine model to use
        if (!modelId) {
            const fallback = await prisma.model.findFirst({
                where: { provider: 'OpenAI', isActive: true },
                orderBy: { createdAt: 'asc' }
            });
            if (!fallback) {
                return res.status(400).json({ error: 'No default OpenAI model configured' });
            }
            modelId = fallback.id;
        }

        const model = await prisma.model.findUnique({ where: { id: modelId } });
        if (!model) {
            return res.status(400).json({ error: 'Invalid model ID' });
        }

        console.log('🧠 Using model:', model.name);

        // 2. Create new session if needed
        let session = null;
        if (!sessionId) {
            session = await prisma.chatSession.create({
                data: {
                    title: `New Chat - ${new Date().toLocaleString()}`,
                    userId: req.user.userId,
                    accountId: req.user.accountId
                }
            });
        }

        const activeSessionId = sessionId || session.id;

        // 3. Build RAG context from knowledge base (if provided)
        let context = '';
        if (knowledgeBaseId !== 'none') {
            try {
                const kb = await prisma.knowledgeBase.findUnique({
                    where: { id: knowledgeBaseId }
                });

                const embeddingModel = kb?.embeddingModel || 'text-embedding-3-small';

                const chunks = await getRelevantChunks({
                    query,
                    knowledgeBaseId,
                    useVector: true,
                    embeddingModel
                });

                if (chunks.length > 0) {
                    const MAX_CHUNK_LENGTH = 800;
                    context = chunks
                        .map((doc, idx) => {
                            const truncated = doc.text.length > MAX_CHUNK_LENGTH
                                ? doc.text.slice(0, MAX_CHUNK_LENGTH) + '...'
                                : doc.text;
                            return `${idx + 1}. ${truncated} (source: ${doc.source})`;
                        })
                        .join('\n');
                }
            } catch (err) {
                console.warn('⚠️ Failed to load RAG context:', err);
            }
        } else {
            console.log(`🔍 No knowledge base used for user ${req.user.userId}`);
        }

        // 4. Build and send prompt
        const inputPrompt = `System: You are a helpful assistant.\n\nContext:\n${context || 'None'}\n\nHuman: ${query}\nAssistant:`;

        const rawAnswer = await routeToModel({
            provider: model.provider,
            modelId: model.providerModelId,
            prompt: inputPrompt
        });

        const answer = formatAndSanitize(rawAnswer);

        // 5. Save messages
        await prisma.chatMessage.createMany({
            data: [
                {
                    sessionId: activeSessionId,
                    userId: req.user.userId,
                    accountId: req.user.accountId,
                    role: 'user',
                    content: query
                },
                {
                    sessionId: activeSessionId,
                    userId: req.user.userId,
                    accountId: req.user.accountId,
                    role: 'assistant',
                    content: answer,
                    modelName: model.name
                }
            ]
        });

        res.json({
            answer,
            sessionId: activeSessionId,
            modelName: model.name
        });

    } catch (err) {
        console.error('❌ Chat route error:', err);
        res.status(500).json({ error: 'Chat failed to generate response', details: err.message });
    }
});

module.exports = router;