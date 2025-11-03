import WebSocket from "ws";

async function testLogsSubscribe() {
  const ws = new WebSocket("wss://devnet.helius-rpc.com/?api-key=9f52f156-8987-4d04-953f-54db6be65ec2");

  ws.on("open", () => {
    console.log("[TEST] Connected — sending logsSubscribe...");

    const msg = {
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [
        { mentions: ["CUnwp6fNuox6A7Qk9hFuJUX98paSfHf9zJqsad9TynLD"] },
        { commitment: "confirmed" },
      ],
    };

    ws.send(JSON.stringify(msg));
  });

  ws.on("message", (data) => {
    const parsed = JSON.parse(data.toString());

    // Confirm subscription
    if (parsed.result && parsed.id === 1) {
      console.log("[TEST] ✅ Subscription established:", parsed.result);
      return;
    }

    // Streamed log updates
    if (parsed.method === "logsNotification") {
      console.log("[TEST][LOGS] New program log:");
      console.dir(parsed.params?.result?.value, { depth: null });
    } else {
      console.log("[RAW]", parsed);
    }
  });

  ws.on("error", (err) => {
    console.error("[TEST] WebSocket error:", err);
  });
}

testLogsSubscribe();
