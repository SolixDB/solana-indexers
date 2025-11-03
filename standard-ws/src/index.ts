import "dotenv/config";
import { loadIndexerConfig } from "./config/IndexerConfig";
import { WebSocketPool } from "./lib/WebSocketPool";

async function main() {
  const config = loadIndexerConfig();
  console.log(`[SYSTEM] Starting ${config.INDEXER_TYPE} indexer...`);
  console.log(`[SYSTEM] Connecting to endpoint: ${config.ENDPOINT}`);

  // Initialize WebSocket pool
  const pool = new WebSocketPool({
    endpoint: config.ENDPOINT,
    maxConnections: 3,
  });

  // Register global message handler BEFORE creating connections
  pool.onMessage((data) => {
    try {
      const parsed = JSON.parse(data.toString());

      // Confirm subscription
      if (parsed.result && typeof parsed.id === "number") {
        console.log(`[SUBSCRIPTION] ID: ${parsed.id}, Result:`, parsed.result);
        return;
      }

      // Handle errors
      if (parsed.error) {
        console.error(`[ERROR] RPC Error:`, parsed.error);
        return;
      }

      // Catch-all for other messages
      console.log(`[STREAM][${config.INDEXER_TYPE}]`, JSON.stringify(parsed, null, 2));
    } catch {
      console.log("[RAW]", data.toString());
    }
  });

  // Handle subscriptions dynamically based on .env
  if (config.TARGET_ADDRESSES && config.TARGET_ADDRESSES.length > 0) {
    for (const address of config.TARGET_ADDRESSES) {
      try {
        console.log(`[INFO] Subscribing to ${address} using ${config.INDEXER_TYPE}...`);

        // Build proper params based on subscription type
        let params: any[];

        switch (config.INDEXER_TYPE) {
          case "logsSubscribe":
            params = [
              { mentions: [address] },
              { commitment: "confirmed" }
            ];
            break;

          case "accountSubscribe":
            params = [
              address,
              { commitment: "confirmed", encoding: "jsonParsed" }
            ];
            break;

          case "programSubscribe":
            params = [
              address,
              { commitment: "confirmed", encoding: "jsonParsed" }
            ];
            break;

          case "signatureSubscribe":
            params = [
              address,
              { commitment: "confirmed" }
            ];
            break;

          case "slotSubscribe":
            params = [];
            break;

          case "blockSubscribe":
            params = [
              "all",
              { commitment: "confirmed", encoding: "json", transactionDetails: "full" }
            ];
            break;

          default:
            params = [address];
        }

        await pool.subscribe(config.INDEXER_TYPE, params);
        console.log(`[SUCCESS] Subscription sent for ${address}`);
      } catch (err) {
        console.error(`[ERROR] Failed to subscribe to ${address}:`, err);
      }
    }
  } else {
    console.warn("[WARN] No TARGET_ADDRESSES found — indexer running idle.");
  }

  console.log("[SYSTEM] All subscriptions sent successfully.");
  console.log("[SYSTEM] Listening for real-time updates...");
}

main().catch((err) => {
  console.error("[FATAL] Unhandled error in main:", err);
  process.exit(1);
});