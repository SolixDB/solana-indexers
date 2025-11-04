import WebSocket from "ws";

interface EnhancedNodeConnectionMonitorOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  baseDelay?: number;
  maxDelay?: number;
  pingInterval?: number;
  maxRetries?: number;
}

export class EnhancedNodeConnectionMonitor {
  public ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private isReconnecting = false;
  private lastFailureTime: number | null = null;
  private failureCount = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  readonly url: string;
  isAlive = false;

  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly pingIntervalMs: number;
  private readonly maxRetries: number;

  // Callbacks for reconnection and message handling
  public onReconnect?: () => Promise<void>;
  public onMessage?: (data: Buffer) => void;

  constructor(url: string, options: EnhancedNodeConnectionMonitorOptions = {}) {
    this.url = url;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeout = options.recoveryTimeout ?? 60_000;
    this.baseDelay = options.baseDelay ?? 1_000;
    this.maxDelay = options.maxDelay ?? 30_000;
    this.pingIntervalMs = options.pingInterval ?? 30_000;
    this.maxRetries = options.maxRetries ?? 10;
  }

  /** Waits until connection is open before resolving */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === "OPEN") {
        const sinceLastFailure = Date.now() - (this.lastFailureTime ?? 0);
        if (sinceLastFailure < this.recoveryTimeout) {
          console.warn("[WARN] Enhanced circuit breaker is OPEN. Skipping connection attempt.");
          return resolve();
        }
        console.info("[INFO] Enhanced circuit breaker moving to HALF_OPEN state.");
        this.state = "HALF_OPEN";
      }

      console.log(`[INFO] Enhanced connecting to ${this.url}...`);
      try {
        this.ws = new WebSocket(this.url);
        this.setupEventHandlers(resolve);
      } catch (err) {
        console.error("[ERROR] Enhanced WebSocket connection error:", err);
        this.recordFailure();
        this.scheduleReconnect();
        reject(err);
      }
    });
  }

  private setupEventHandlers(onOpen?: () => void) {
    if (!this.ws) return;

    this.ws.on("open", async () => {
      const isReconnection = !onOpen;
      console.log(`[SUCCESS] Enhanced ${isReconnection ? 'Reconnected' : 'Connected'} to ${this.url}`);

      this.state = "CLOSED";
      this.failureCount = 0;
      this.retryCount = 0;
      this.isReconnecting = false;
      this.isAlive = true;

      this.startHeartbeat();

      // CRITICAL: Attach message handler to THIS WebSocket instance
      if (this.onMessage && this.ws) {
        this.ws.on("message", this.onMessage);
        console.log("[DEBUG] Enhanced message handler attached to WebSocket");
      } else {
        console.warn("[WARN] No message handler to attach!");
      }

      // Call appropriate callback
      if (onOpen) {
        onOpen();
      } else if (this.onReconnect) {
        await this.onReconnect();
      }
    });

    this.ws.on("close", (code: number) => {
      console.warn(`[WARN] Enhanced connection closed (code: ${code})`);
      this.stopHeartbeat();
      this.recordFailure();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[ERROR] Enhanced WebSocket error:", err);
      this.recordFailure();
    });

    this.ws.on("pong", () => {
      this.isAlive = true;
    });
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.log(`[INFO] Enhanced failure recorded (${this.failureCount}/${this.failureThreshold})`);

    if (this.failureCount >= this.failureThreshold) {
      console.error("[ERROR] Enhanced circuit breaker OPENED due to repeated failures.");
      this.state = "OPEN";
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting || this.retryCount >= this.maxRetries) return;

    this.isReconnecting = true;
    this.retryCount++;

    const delay = Math.min(this.baseDelay * Math.pow(2, this.retryCount - 1), this.maxDelay);
    const jitter = Math.random() * 1000;
    const totalDelay = delay + jitter;

    console.log(
      `[INFO] Enhanced reconnecting in ${Math.round(totalDelay)}ms (attempt ${this.retryCount}/${this.maxRetries})`
    );

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, totalDelay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (!this.ws) return;

      if (!this.isAlive) {
        console.warn("[WARN] Enhanced connection lost (no pong), terminating and reconnecting...");
        this.ws.terminate();
        this.recordFailure();
        this.scheduleReconnect();
        return;
      }

      this.isAlive = false;
      this.ws.ping();
    }, this.pingIntervalMs);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  get socket(): WebSocket | null {
    return this.ws;
  }
}