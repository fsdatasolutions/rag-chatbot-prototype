
const axios = require('axios');

/**
 * Converts plain text into a vector embedding using OpenAI.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing OPENAI_API_KEY in environment');
    }

    const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
            model: 'text-embedding-3-small', // You can switch to 'text-embedding-ada-002' if needed
            input: text
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.data[0].embedding;
}

module.exports = embedText;