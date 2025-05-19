const { GetAccessPolicyCommand } = require('@aws-sdk/client-opensearchserverless');

/**
 * Waits for an OpenSearch Serverless access policy to become available.
 *
 * @param {OpenSearchServerlessClient} client
 *
 * @param {string} policyName
 * @param {string} policyType - should be 'data'
 * @param {number} maxAttempts
 * @param {number} delayMs
 */
async function waitForPolicyPropagation(client, policyName, policyType = 'data', maxAttempts = 100, delayMs = 3000) {
    console.log("🔍 Waiting for IAM access policy propagation...");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await client.send(new GetAccessPolicyCommand({
                name: policyName,
                type: policyType
            }));

            if (response.accessPolicyDetail?.name === policyName) {
                console.log(`✅ Access policy ${policyName} is now visible (attempt ${attempt})`);
                return;
            }
        } catch (err) {
            console.warn(`⚠️ Attempt ${attempt}: Policy ${policyName} not yet visible. Retrying...`);
        }

        await new Promise(res => setTimeout(res, delayMs));
    }

    throw new Error(`❌ Timed out waiting for access policy ${policyName} to propagate`);
}

module.exports = { waitForPolicyPropagation };