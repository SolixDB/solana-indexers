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

  // Unified message handler that calls all registered handlers
  private handleMessage = (data: Buffer): void => {
    console.log("[DEBUG] handleMessage called, data length:", data.length);
    for (const handler of this.messageHandlers) {
      handler(data);
    }
  };

  // Get or create a healthy connection
  public async getConnection(): Promise<NodeConnectionMonitor> {
    if (this.connections.length < this.maxConnections) {
      const monitor = new NodeConnectionMonitor(this.endpoint);
      
      // IMPORTANT: Set handlers BEFORE connecting
      monitor.onMessage = this.handleMessage;
      
      monitor.onReconnect = async () => {
        console.log("[INFO] Connection reconnected, resubscribing...");
        await this.resubscribeAll(monitor);
      };

      await monitor.connect();
      this.connections.push(monitor);
      
      console.log("[DEBUG] Message handler attached:", !!monitor.onMessage);
      
      return monitor;
    }

    const conn = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return conn;
  }

  // Resubscribe all tracked subscriptions on a specific connection
  private async resubscribeAll(monitor: NodeConnectionMonitor): Promise<void> {
    const ws = monitor.socket;
    if (!ws || ws.readyState !== ws.OPEN) {
      console.warn("[WARN] Cannot resubscribe - WebSocket not ready");
      return;
    }

    const active = this.subscriptionManager.getActive();
    console.log(`[INFO] Resubscribing ${active.length} subscriptions...`);

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
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit
      } catch (err) {
        console.error(`[ERROR] Failed to resubscribe ${sub.id}:`, err);
      }
    }
  }

  // Simplified subscribe API
  async subscribe(method: string, params: any): Promise<number | null> {
    const conn = await this.getConnection();
    const ws = conn.socket;
    
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
      conn.socket?.close?.();
    }
    this.connections.length = 0;
    console.log("[INFO] Closed all WebSocket connections.");
  }

  // Expose subscription manager for debugging
  get subscriptions() {
    return this.subscriptionManager;
  }
}