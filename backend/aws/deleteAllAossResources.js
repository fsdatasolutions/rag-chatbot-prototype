// deleteAllAossResources.js
const {
    OpenSearchServerlessClient,
    ListCollectionsCommand,
    DeleteCollectionCommand,
    ListSecurityPoliciesCommand,
    DeleteSecurityPolicyCommand,
    ListAccessPoliciesCommand,
    DeleteAccessPolicyCommand
} = require("@aws-sdk/client-opensearchserverless");

const REGION = process.env.AWS_REGION || 'us-west-2';
const client = new OpenSearchServerlessClient({ region: REGION });

async function deleteAllCollections() {
    const { collectionSummaries } = await client.send(new ListCollectionsCommand({}));

    if (!collectionSummaries || collectionSummaries.length === 0) {
        console.log("✅ No collections to delete.");
        return;
    }

    for (const { id, name } of collectionSummaries) {
        console.log(`🗑️ Deleting collection: ${name}`);
        await client.send(new DeleteCollectionCommand({ id }));
        console.log(`✅ Deleted collection: ${name}`);
    }
}

async function deleteAllSecurityPolicies() {
    for (const type of ["network"]) {
        const { securityPolicySummaries } = await client.send(
            new ListSecurityPoliciesCommand({ type })
        );

        if (!securityPolicySummaries || securityPolicySummaries.length === 0) {
            console.log(`✅ No ${type} security policies to delete.`);
            continue;
        }

        for (const { name } of securityPolicySummaries) {
            console.log(`🛡️ Deleting ${type} policy: ${name}`);
            await client.send(new DeleteSecurityPolicyCommand({ name, type }));
        }
    }
}

async function deleteAllAccessPolicies() {
    const { accessPolicySummaries } = await client.send(new ListAccessPoliciesCommand({}));

    if (!accessPolicySummaries || accessPolicySummaries.length === 0) {
        console.log("✅ No access policies to delete.");
        return;
    }

    for (const { name } of accessPolicySummaries) {
        console.log(`🔑 Deleting access policy: ${name}`);
        await client.send(new DeleteAccessPolicyCommand({ name, type: "data" }));
    }
}

(async () => {
    try {
        await deleteAllCollections();
        await deleteAllSecurityPolicies();
        await deleteAllAccessPolicies();
        console.log("✅ All OpenSearch Serverless resources deleted.");
    } catch (err) {
        console.error("❌ Error deleting OpenSearch resources:", err);
    }
})();