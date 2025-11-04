import { EnhancedManagedSubscriptionPool } from "./ManagedSubscriptionPool";
import { EnhancedNodeConnectionMonitor } from "./NodeConnectionMonitor";

export interface EnhancedWebSocketPoolOptions {
  endpoint: string;
  maxConnections?: number;
  maxSubscriptions?: number;
}

export class EnhancedWebSocketPool {
  private readonly endpoint: string;
  private readonly maxConnections: number;
  private readonly connections: EnhancedNodeConnectionMonitor[] = [];
  private currentIndex = 0;
  private readonly subscriptionManager: EnhancedManagedSubscriptionPool;
  private messageHandlers: Array<(data: Buffer) => void> = [];

  constructor(options: EnhancedWebSocketPoolOptions) {
    this.endpoint = options.endpoint;
    this.maxConnections = options.maxConnections ?? 3;
    this.subscriptionManager = new EnhancedManagedSubscriptionPool({
      maxSubscriptions: options.maxSubscriptions ?? 200,
    });
  }

  public onMessage(handler: (data: Buffer) => void): void {
    this.messageHandlers.push(handler);
  }

  // Unified message handler that calls all registered handlers
  private handleMessage = (data: Buffer): void => {
    for (const handler of this.messageHandlers) {
      handler(data);
    }
  };

  // Get or create a healthy connection
  public async getConnection(): Promise<EnhancedNodeConnectionMonitor> {
    if (this.connections.length < this.maxConnections) {
      const monitor = new EnhancedNodeConnectionMonitor(this.endpoint);

      // CRITICAL: Set message handler BEFORE connecting
      monitor.onMessage = this.handleMessage;

      // Set up reconnection callback to resubscribe
      monitor.onReconnect = async () => {
        console.log("[INFO] Enhanced connection reconnected, resubscribing...");
        await this.resubscribeAll(monitor);
      };

      await monitor.connect();
      this.connections.push(monitor);
      return monitor;
    }

    const conn = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return conn;
  }

  // Resubscribe all tracked subscriptions on a specific connection
  private async resubscribeAll(monitor: EnhancedNodeConnectionMonitor): Promise<void> {
    const ws = monitor.socket;
    if (!ws || ws.readyState !== ws.OPEN) {
      console.warn("[WARN] Cannot resubscribe - Enhanced WebSocket not ready");
      return;
    }

    const active = this.subscriptionManager.getActive();
    console.log(`[INFO] Resubscribing ${active.length} enhanced subscriptions...`);

    for (const sub of active) {
      try {
        const message = {
          jsonrpc: "2.0",
          id: sub.id,
          method: sub.method,
          params: sub.params,
        };
        ws.send(JSON.stringify(message));
        console.log(`[INFO] Resubscribed: ${sub.method} (${sub.id})`);
        await new Promise((resolve) => setTimeout(resolve, 50)); // Rate limit
      } catch (err) {
        console.error(`[ERROR] Failed to resubscribe ${sub.id}:`, err);
      }
    }
  }

  // Simplified subscribe API
  async subscribe(method: string, params: any[]): Promise<number | null> {
    const conn = await this.getConnection();
    const ws = conn.socket;

    if (!ws || ws.readyState !== ws.OPEN) {
      console.warn("[WARN] Enhanced WebSocket not ready, skipping subscribe.");
      return null;
    }

    const requestId = Math.floor(Math.random() * 1_000_000);
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
      conn.socket?.close?.();
    }
    this.connections.length = 0;
    this.subscriptionManager.clearAll();
    console.log("[INFO] Closed all Enhanced WebSocket connections.");
  }

  // Expose subscription manager for debugging
  get subscriptions() {
    return this.subscriptionManager;
  }
}