import "dotenv/config";
import { loadEnhancedIndexerConfig } from "./config/IndexerConfig";
import { EnhancedIndexerType } from "./config/IndexerTypes";
import { EnhancedWebSocketPool } from "./lib/WebSocketPool";

async function main() {
  const config = loadEnhancedIndexerConfig();

  console.log(`[SYSTEM] Starting Enhanced ${config.INDEXER_TYPE} indexer...`);
  console.log(`[SYSTEM] Connecting to endpoint: ${config.ENDPOINT}`);

  // Initialize Enhanced WebSocket pool
  const pool = new EnhancedWebSocketPool({
    endpoint: config.ENDPOINT,
    maxConnections: 3,
    maxSubscriptions: 200,
  });

  // Register global message handler BEFORE creating connections
  pool.onMessage((data) => {
    try {
      const parsed = JSON.parse(data.toString());

      // Confirm subscription
      if (parsed.result !== undefined && typeof parsed.id === "number") {
        console.log(`[SUBSCRIPTION] ID: ${parsed.id}, Result:`, parsed.result);
        return;
      }

      // Handle errors
      if (parsed.error) {
        console.error(`[ERROR] RPC Error:`, parsed.error);
        return;
      }

      // Handle transaction notifications
      if (parsed.method === "transactionNotification") {
        const result = parsed.params?.result;
        console.log(`[TRANSACTION] Slot: ${result?.slot}, Signature: ${result?.signature}`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Handle account notifications
      if (parsed.method === "accountNotification") {
        const result = parsed.params?.result;
        console.log(`[ACCOUNT] Slot: ${result?.context?.slot}`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Catch-all for other messages
      console.log(`[STREAM][${config.INDEXER_TYPE}]`, JSON.stringify(parsed, null, 2));
    } catch {
      console.log("[RAW]", data.toString());
    }
  });

  // Handle subscriptions based on indexer type
  if (config.INDEXER_TYPE === EnhancedIndexerType.TRANSACTION) {
    console.log("[INFO] Setting up transactionSubscribe...");

    // Build params according to Helius spec
    const filter = config.TRANSACTION_FILTER || {};
    const options = config.TRANSACTION_OPTIONS || {};
    
    // Log what we're sending for debugging
    console.log("[DEBUG] Filter:", JSON.stringify(filter, null, 2));
    console.log("[DEBUG] Options:", JSON.stringify(options, null, 2));

    const params = [filter, options];

    try {
      await pool.subscribe(EnhancedIndexerType.TRANSACTION, params);
      console.log("[SUCCESS] Transaction subscription sent");
    } catch (err) {
      console.error("[ERROR] Failed to subscribe to transactions:", err);
    }
  } else if (config.INDEXER_TYPE === EnhancedIndexerType.ACCOUNT) {
    if (!config.TARGET_ADDRESSES || config.TARGET_ADDRESSES.length === 0) {
      console.error("[ERROR] accountSubscribe requires at least one TARGET_ADDRESS");
      process.exit(1);
    }

    console.log("[INFO] Setting up accountSubscribe...");

    for (const address of config.TARGET_ADDRESSES) {
      try {
        const params = [address, config.ACCOUNT_OPTIONS];
        await pool.subscribe(EnhancedIndexerType.ACCOUNT, params);
        console.log(`[SUCCESS] Account subscription sent for ${address}`);
      } catch (err) {
        console.error(`[ERROR] Failed to subscribe to account ${address}:`, err);
      }
    }
  }

  console.log("[SYSTEM] All subscriptions sent successfully.");
  console.log("[SYSTEM] Listening for real-time Enhanced WebSocket updates...");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[SYSTEM] Shutting down gracefully...");
    pool.closeAll();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[FATAL] Unhandled error in main:", err);
  process.exit(1);
});