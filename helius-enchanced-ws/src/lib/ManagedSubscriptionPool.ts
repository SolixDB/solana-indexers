export interface EnhancedSubscriptionRecord {
  id: number;
  method: string;
  params: any[];
  timestamp: number;
}

export interface EnhancedManagedSubscriptionPoolOptions {
  maxSubscriptions?: number;
  cleanupRatio?: number;
}

export class EnhancedManagedSubscriptionPool {
  private subscriptions: Map<number, EnhancedSubscriptionRecord> = new Map();
  private readonly maxSubscriptions: number;
  private readonly cleanupRatio: number;

  constructor(options: EnhancedManagedSubscriptionPoolOptions = {}) {
    this.maxSubscriptions = options.maxSubscriptions ?? 100;
    this.cleanupRatio = options.cleanupRatio ?? 0.1;
  }

  /** Add a new subscription and handle overflow */
  addSubscription(id: number, method: string, params: any[]): void {
    if (this.subscriptions.size >= this.maxSubscriptions) {
      this.cleanupOldSubscriptions();
    }

    this.subscriptions.set(id, {
      id,
      method,
      params,
      timestamp: Date.now(),
    });

    console.log(`[POOL] Added subscription ${id} (${method}). Total: ${this.subscriptions.size}`);
  }

  /** Remove a subscription by ID */
  removeSubscription(id: number): void {
    const existed = this.subscriptions.delete(id);
    if (existed) {
      console.log(`[POOL] Removed subscription ${id}. Total: ${this.subscriptions.size}`);
    }
  }

  /** Automatically remove oldest N% of subscriptions */
  private cleanupOldSubscriptions(): void {
    const toRemove = Math.floor(this.subscriptions.size * this.cleanupRatio);
    const oldest = [...this.subscriptions.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, toRemove);

    for (const sub of oldest) {
      this.subscriptions.delete(sub.id);
      console.log(`[POOL] Cleaned up old subscription ${sub.id} (${sub.method})`);
    }
  }

  /** Get current active subscriptions */
  getActive(): EnhancedSubscriptionRecord[] {
    return [...this.subscriptions.values()];
  }

  /** Get subscription count */
  getCount(): number {
    return this.subscriptions.size;
  }

  /** Clear all subscriptions */
  clearAll(): void {
    const count = this.subscriptions.size;
    this.subscriptions.clear();
    console.log(`[POOL] Cleared all ${count} subscriptions`);
  }
}