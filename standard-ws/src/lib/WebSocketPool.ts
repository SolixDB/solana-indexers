import { ManagedSubscriptionPool } from "./ManagedSubscriptionPool";
import { NodeConnectionMonitor } from "./NodeConnectionMonitor";

export interface WebSocketPoolOptions {
  endpoint: string;
  maxConnections?: number;
  maxSubscriptions?: number;
}

export class WebSocketPool {
  private readonly endpoint: string;
  private readonly maxConnections: number;
  private readonly connections: NodeConnectionMonitor[] = [];
  private currentIndex = 0;
  private readonly subscriptionManager: ManagedSubscriptionPool;
  private messageHandlers: Array<(data: Buffer) => void> = [];

  constructor(options: WebSocketPoolOptions) {
    this.endpoint = options.endpoint;
    this.maxConnections = options.maxConnections ?? 3;
    this.subscriptionManager = new ManagedSubscriptionPool({
      maxSubscriptions: options.maxSubscriptions ?? 200,
    });
  }

  public onMessage(handler: (data: Buffer) => void): void {
    this.messageHandlers.push(handler);
  }

  // Get or create a healthy connection
  public async getConnection(): Promise<NodeConnectionMonitor> {
    if (this.connections.length < this.maxConnections) {
      const monitor = new NodeConnectionMonitor(this.endpoint);
      await monitor.connect();

      // Attach message handlers to EVERY new connection
      if (monitor.ws) {
        monitor.ws.on("message", (data: Buffer) => {
          for (const handler of this.messageHandlers) {
            handler(data);
          }
        });
      }

      this.connections.push(monitor);
      return monitor;
    }

    const conn = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return conn;
  }

  // Simplified subscribe API
  async subscribe(method: string, params: any): Promise<number | null> {
    const conn = await this.getConnection();
    const ws = (conn as any).socket; // exposed getter in NodeConnectionMonitor

    if (!ws || ws.readyState !== ws.OPEN) {
      console.warn("[WARN] WebSocket not ready, skipping subscribe.");
      return null;
    }

    const requestId = Math.floor(Math.random() * 10000);
    const message = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    };

    ws.send(JSON.stringify(message));
    this.subscriptionManager.addSubscription(requestId, method, params);

    console.log(`[INFO] Sent ${method} (${requestId})`);
    return requestId;
  }

  // Close all connections gracefully
  closeAll(): void {
    for (const conn of this.connections) {
      (conn as any).socket?.close?.();
    }
    this.connections.length = 0;
    console.log("[INFO] Closed all WebSocket connections.");
  }
}
