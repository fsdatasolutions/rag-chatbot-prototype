// backend/routes/chat.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { fromIni } = require('@aws-sdk/credential-provider-ini');
const formatAndSanitize = require('../utils/formatAndSanitize');
const config = require('../modelConfig');
const prisma = require('../db/prisma');

const bedrockRuntimeClient = new BedrockRuntimeClient({
    region: config.region,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' })
});

const bedrockAgentClient = new BedrockAgentRuntimeClient({
    region: config.region,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' })
});

const MODEL_ID = config.defaultModel;
const DEFAULT_KNOWLEDGE_BASE_ID = '8P6ZV0FHYN';

router.post('/', authenticateToken, async (req, res) => {
    const { query, knowledgeBaseId= DEFAULT_KNOWLEDGE_BASE_ID, modelId = MODEL_ID, sessionId } = req.body;
    console.log('loading chat route');

    if (!query ) {
        return res.status(400).json({ error: 'Missing query ' });
    }

    try {
        // 🔧 Step 1: Create session if none provided
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
        const kbToUse = knowledgeBaseId || DEFAULT_KNOWLEDGE_BASE_ID;

        // 🔍 Step 2: Retrieve KB context
        let context = '';

        if (knowledgeBaseId !== 'none') {
            try {
                const retrieveCommand = new RetrieveCommand({
                    knowledgeBaseId,
                    retrievalQuery: { text: query },
                    retrievalConfiguration: {
                        vectorSearchConfiguration: { numberOfResults: 3 }
                    }
                });

                const retrievalResponse = await bedrockAgentClient.send(retrieveCommand);
                const contextDocs = retrievalResponse.retrievalResults || [];
                context = contextDocs.map((doc, idx) => `${idx + 1}. ${doc.content.text}`).join('\n');
            } catch (err) {
                console.warn('⚠️ Failed to retrieve from KB. Proceeding without context.', err);
            }
        }

        if (knowledgeBaseId === 'none') {
            console.log(`🔍 User ${req.user.userId} is chatting without a KB`);
        }

        const inputPrompt = `System: You are a helpful assistant.\n\nContext:\n${context || 'None'}\n\nHuman: ${query}\nAssistant:`;
        console.log("🧠 Using model:", modelId);

        let inputPayload;

        if (
            modelId.startsWith('anthropic.') ||
            modelId.startsWith('meta.') // ← add this check
        ) {
            inputPayload = JSON.stringify({
                prompt: inputPrompt,
                max_tokens_to_sample: 1000,
                temperature: 0.5
            });
        } else {
            inputPayload = JSON.stringify({
                inputText: inputPrompt,
                textGenerationConfig: {
                    maxTokenCount: 1000,
                    temperature: 0.5
                }
            });
        }

        const invokeCommand = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: inputPayload
        });

        const modelResponse = await bedrockRuntimeClient.send(invokeCommand);
        const responseBody = new TextDecoder().decode(modelResponse.body);
        const parsed = JSON.parse(responseBody);
        const rawAnswer = parsed.completion || 'No answer returned.';
        const answer = formatAndSanitize(rawAnswer);

        // 💾 Step 3: Save chat messages
        await prisma.chatMessage.createMany({
            data: [
                {
                    sessionId: activeSessionId,
                    userId: req.user.userId,
                    accountId: req.user.accountId, // ✅ include this
                    role: 'user',
                    content: query
                },
                {
                    sessionId: activeSessionId,
                    userId: req.user.userId,
                    accountId: req.user.accountId, // ✅ include this
                    role: 'assistant',
                    content: answer
                }
            ]
        });

        res.json({ answer, sessionId: activeSessionId });

    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Chat failed to generate response' });
    }
});

module.exports = router;