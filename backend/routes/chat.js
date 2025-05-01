// backend/routes/chat.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const prisma = require('../db/prisma');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const bedrockRuntimeClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' })
});

const bedrockAgentClient = new BedrockAgentRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' })
});

router.post('/', authenticateToken, async (req, res) => {
    const { query, knowledgeBaseId, modelId = 'anthropic.claude-v2' } = req.body;

    if (!query || !knowledgeBaseId) {
        return res.status(400).json({ error: 'Missing query or knowledgeBaseId' });
    }

    try {
        // Step 1: Retrieve context from Bedrock KB
        const retrieveCommand = new RetrieveCommand({
            knowledgeBaseId,
            retrievalQuery: { text: query },
            retrievalConfiguration: {
                vectorSearchConfiguration: {
                    numberOfResults: 3
                }
            }
        });

        const retrievalResponse = await bedrockAgentClient.send(retrieveCommand);
        const contextDocs = retrievalResponse.retrievalResults || [];
        const context = contextDocs.map((doc, idx) => `${idx + 1}. ${doc.content.text}`).join('\n');

        // Step 2: Format prompt
        const inputPrompt = `System: You are a helpful assistant.\n\nContext:\n${context}\n\nHuman: ${query}\nAssistant:`;

        // Step 3: Invoke model
        const inputPayload = JSON.stringify({
            prompt: inputPrompt,
            max_tokens_to_sample: 1000,
            temperature: 0.5
        });

        const invokeCommand = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: inputPayload
        });

        const modelResponse = await bedrockRuntimeClient.send(invokeCommand);
        const responseBody = new TextDecoder().decode(modelResponse.body);
        const parsed = JSON.parse(responseBody);
        const answer = parsed.completion || 'No response generated.';

        res.json({ answer });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Chat failed to generate response' });
    }
});

module.exports = router;
