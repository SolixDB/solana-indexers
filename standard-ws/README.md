# standard-ws

A production-ready WebSocket connection pool for Solana RPC subscriptions with automatic reconnection, circuit breaker pattern, and subscription management.

## Features

- Connection pooling with configurable maximum connections
- Automatic reconnection with exponential backoff
- Circuit breaker pattern to prevent cascading failures
- Heartbeat monitoring to detect stale connections
- Subscription management with automatic cleanup
- Support for all Solana RPC subscription methods
- Type-safe configuration with TypeScript

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
INDEXER_TYPE=YOUR_INDEXER_TYPE
ENDPOINT=wss://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
TARGET_ADDRESSES=YOUR_ADDRESS,ANOTHER_ADDRESS
```

### Supported Indexer Types

- `ACCOUNT` - Monitor account changes
- `BLOCK` - Monitor new blocks
- `LOGS` - Monitor transaction logs
- `PROGRAM` - Monitor program account changes
- `SIGNATURE` - Monitor transaction confirmations
- `SLOT` - Monitor slot changes
- `SLOTS_UPDATES` - Monitor slot update events
- `ROOT` - Monitor root changes
- `VOTE` - Monitor vote transactions

## Usage

### Basic Example

```typescript
import { WebSocketPool } from "./lib/WebSocketPool";

const pool = new WebSocketPool({
  endpoint: "wss://api.mainnet-beta.solana.com",
  maxConnections: 3,
  maxSubscriptions: 200,
});

// Register message handler
pool.onMessage((data) => {
  const parsed = JSON.parse(data.toString());
  console.log("Received:", parsed);
});

// Subscribe to logs
await pool.subscribe("logsSubscribe", [
  { mentions: ["YOUR_PROGRAM_ID"] },
  { commitment: "confirmed" }
]);
```

### Running the Indexer

```bash
npm start
```

## Architecture

### WebSocketPool

Manages multiple WebSocket connections and distributes subscriptions across them.

**Options:**
- `endpoint` - WebSocket URL
- `maxConnections` - Maximum concurrent connections (default: 3)
- `maxSubscriptions` - Maximum subscriptions per pool (default: 200)

### NodeConnectionMonitor

Monitors individual WebSocket connections with health checks and automatic recovery.

**Features:**
- Exponential backoff for reconnection attempts
- Configurable failure threshold and recovery timeout
- Heartbeat pings to detect connection issues
- Circuit breaker pattern (CLOSED/OPEN/HALF_OPEN states)

### ManagedSubscriptionPool

Tracks active subscriptions and automatically cleans up old ones when limits are reached.

**Options:**
- `maxSubscriptions` - Maximum tracked subscriptions (default: 100)
- `cleanupRatio` - Percentage of oldest subscriptions to remove (default: 0.1)

## Error Handling

The library implements multiple layers of error handling:

1. **Connection Level**: Automatic reconnection with exponential backoff
2. **Circuit Breaker**: Prevents repeated connection attempts to failing endpoints
3. **Subscription Level**: Tracks and manages subscription lifecycle
4. **Pool Level**: Distributes load and handles connection failures gracefully

## Development

### Project Structure

```
src/
├── config/
│   └── IndexerConfig.ts      # Configuration loader
├── lib/
│   ├── WebSocketPool.ts      # Connection pool manager
│   ├── NodeConnectionMonitor.ts  # Individual connection monitor
│   └── ManagedSubscriptionPool.ts  # Subscription tracker
└── main.ts                   # Entry point
```

### Testing

Run the test suite to verify WebSocket connectivity:

```bash
npm run start
```

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.