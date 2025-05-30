//backend/server.js
const express = require('express');
const cors = require('cors');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { fromIni } = require('@aws-sdk/credential-provider-ini');
const config = require('./modelConfig'); // Import model config

const app = express();
app.use(cors());
app.use(express.json());

require('dotenv').config();


// Initialize Bedrock Runtime Client
const bedrockRuntimeClient = new BedrockRuntimeClient({
    region: config.region,
    credentials: fromIni({ profile: 'ShannonM' }),
});

// Initialize Bedrock Agent Runtime Client for Knowledge Base
const bedrockAgentClient = new BedrockAgentRuntimeClient({
    region: config.region,
    credentials: fromIni({ profile: 'ShannonM' }),
});

const MODEL_ID = config.defaultModel; // Dynamic Model ID
//// const KNOWLEDGE_BASE_ID = '8P6ZV0FHYN'; // Replace with your Knowledge Base ID

// API Endpoint
// app.post('/api/chat', async (req, res) => {
//     const { query } = req.body;
//
//     if (!query) {
//         return res.status(400).json({ error: 'No query provided.' });
//     }
//
//     try {
//         // Step 1: Retrieve relevant context from Knowledge Base
//         const retrieveCommand = new RetrieveCommand({
//             knowledgeBaseId: KNOWLEDGE_BASE_ID,
//             retrievalQuery: { text: query },
//             retrievalConfiguration: {
//                 vectorSearchConfiguration: {
//                     numberOfResults: 3, // Retrieve top 3 results
//                 },
//             },
//         });
//
//         const retrievalResponse = await bedrockAgentClient.send(retrieveCommand);
//         const documents = retrievalResponse.retrievalResults || [];
//
//         // Extract context from retrieved documents
//         const context = documents
//             .map((doc, idx) => `${idx + 1}. ${doc.content.text}`)
//             .join('\n') || "No relevant documents found.";
//
//         // Step 2: Construct input prompt with retrieved context
//         const inputPrompt = `System: You are a helpful IT support assistant at the University of St. Augustine. Answer based on the provided context.\n\nContext:\n${context}\n\nHuman: ${query}\nAssistant:`;
//
//         // Step 3: Invoke the model with the combined prompt
//         const inputPayload = JSON.stringify({
//             prompt: inputPrompt,
//             max_tokens_to_sample: 1000,
//             temperature: 0.5,
//         });
//
//         const invokeCommand = new InvokeModelCommand({
//             modelId: MODEL_ID,
//             contentType: "application/json",
//             accept: "application/json",
//             body: inputPayload,
//         });
//
//         const modelResponse = await bedrockRuntimeClient.send(invokeCommand);
//         const responseBody = new TextDecoder().decode(modelResponse.body);
//         const parsedBody = JSON.parse(responseBody);
//
//         const answer = parsedBody.completion || "No answer returned.";
//
//         // Step 4: Return the generated answer
//         res.json({ answer });
//     } catch (error) {
//         console.error("Error during Bedrock operations:", error);
//         res.status(500).json({ error: 'Error generating response from Bedrock.' });
//     }
// });

// Middleware
const authenticateToken = require('./middleware/auth');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/chat-history', require('./routes/chatHistory'));
app.use('/api/chat-sessions', require('./routes/chatSessions'));
app.use('/api/models', require('./routes/models'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/knowledge-bases', require('./routes/knowledgeBase'));

const PORT = process.env.PORT || 5001;
console.log("📦 knowledgeBase.js routes loaded...");
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT} using model ID: ${MODEL_ID}`);
});