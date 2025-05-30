//chuckAndEmbedFile.js
const { encode } = require('gpt-tokenizer');
const extractTextFromBuffer = require('./extractTextFromBuffer');
const embedText = require('./embedText');
const insertIntoWeaviate = require('./insertIntoWeaviate');

async function chunkAndEmbedFile({ buffer, fileName, knowledgeBaseId, embeddingModel }) {
    const rawText = await extractTextFromBuffer(buffer, fileName);
    const chunks = chunkText(rawText);

    const embeddedChunks = await Promise.all(
        chunks.map(async (text, idx) => {
            const vector = await embedText(text, embeddingModel);
            return {
                text,
                vector,
                source: fileName,
                chunkIndex: idx,
                knowledgeBaseId
            };
        })
    );

    await insertIntoWeaviate(embeddedChunks);
}

function chunkText(text, maxTokens = 300, overlap = 50) {
    const words = text.split(/\s+/);
    const chunks = [];
    let start = 0;

    while (start < words.length) {
        const chunkWords = words.slice(start, start + maxTokens);
        const chunk = chunkWords.join(' ');
        chunks.push(chunk);
        start += maxTokens - overlap;
    }

    return chunks;
}

module.exports = chunkAndEmbedFile;
