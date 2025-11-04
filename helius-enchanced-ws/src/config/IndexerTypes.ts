export enum EnhancedIndexerType {
  TRANSACTION = "transactionSubscribe",
  ACCOUNT = "accountSubscribe",
}

export interface TransactionSubscribeFilter {
  vote?: boolean;
  failed?: boolean;
  signature?: string;
  accountInclude?: string[];
  accountExclude?: string[];
  accountRequired?: string[];
}

export interface TransactionSubscribeOptions {
  commitment?: "processed" | "confirmed" | "finalized";
  encoding?: "base58" | "base64" | "jsonParsed";
  transactionDetails?: "full" | "signatures" | "accounts" | "none";
  showRewards?: boolean;
  maxSupportedTransactionVersion?: number;
}

export interface AccountSubscribeOptions {
  encoding?: "base58" | "base64" | "base64+zstd" | "jsonParsed";
  commitment?: "finalized" | "confirmed" | "processed";
}

export interface EnhancedSubscriptionParams {
  filter?: TransactionSubscribeFilter;
  options?: TransactionSubscribeOptions | AccountSubscribeOptions;
  account?: string;
}