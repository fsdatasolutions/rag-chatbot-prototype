// modelConfig.js
module.exports = {
    defaultModel: process.env.MODEL_ID || "anthropic.claude-v2", // Default model ID
    region: process.env.AWS_REGION || "us-west-2", // Default AWS Region
};