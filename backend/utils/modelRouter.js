const axios = require('axios');

async function routeToModel({ provider, modelId, prompt }) {
    switch (provider.toLowerCase()) {
        case 'openai':
            return invokeOpenAI(modelId, prompt);
        case 'openrouter':
            return invokeOpenRouter(modelId, prompt);
        case 'together':
            return invokeTogether(modelId, prompt);
        case 'anthropic':
            return invokeAnthropic(modelId, prompt);
        default:
            throw new Error(`Unsupported model provider: ${provider}`);
    }
}

async function invokeOpenAI(modelId, prompt) {
    const apiKey = process.env.OPENAI_API_KEY;

    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: modelId,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data.choices?.[0]?.message?.content || 'No response received.';
}

async function invokeOpenRouter(modelId, prompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            model: modelId,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data.choices?.[0]?.message?.content || 'No response received.';
}

async function invokeTogether(modelId, prompt) {
    const apiKey = process.env.TOGETHER_API_KEY;
    const res = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        {
            model: modelId,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return res.data.choices?.[0]?.message?.content || 'No response received.';
}

async function invokeAnthropic(modelId, prompt) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: modelId,
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        },
        {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        }
    );

    const message = res.data?.content?.[0];
    return typeof message === 'object' ? message.text : message || 'No response received.';
}

module.exports = routeToModel;