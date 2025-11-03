export interface SubscriptionRecord {
  id: number;
  method: string;
  params: any;
  timestamp: number;
}

export interface ManagedSubscriptionPoolOptions {
  maxSubscriptions?: number;
  cleanupRatio?: number;
}

export class ManagedSubscriptionPool {
  private subscriptions: Map<number, SubscriptionRecord> = new Map();
  private readonly maxSubscriptions: number;
  private readonly cleanupRatio: number;

  constructor(options: ManagedSubscriptionPoolOptions = {}) {
    this.maxSubscriptions = options.maxSubscriptions ?? 100;
    this.cleanupRatio = options.cleanupRatio ?? 0.1;
  }

  /** Add a new subscription and handle overflow */
  addSubscription(id: number, method: string, params: any): void {
    if (this.subscriptions.size >= this.maxSubscriptions) {
      this.cleanupOldSubscriptions();
    }

    this.subscriptions.set(id, {
      id,
      method,
      params,
      timestamp: Date.now(),
    });
  }

  /** Remove a subscription by ID */
  removeSubscription(id: number): void {
    this.subscriptions.delete(id);
  }

  /** Automatically remove oldest N% of subscriptions */
  private cleanupOldSubscriptions(): void {
    const toRemove = Math.floor(this.subscriptions.size * this.cleanupRatio);
    const oldest = [...this.subscriptions.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, toRemove);

    for (const sub of oldest) {
      this.subscriptions.delete(sub.id);
      console.log(`[INFO] Cleaned up old subscription ${sub.id} (${sub.method})`);
    }
  }

  /** Get current active subscriptions */
  getActive(): SubscriptionRecord[] {
    return [...this.subscriptions.values()];
  }
}
