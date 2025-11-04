import {
  AccountSubscribeOptions,
  EnhancedIndexerType,
  TransactionSubscribeFilter,
  TransactionSubscribeOptions
} from "./IndexerTypes";

export interface EnhancedIndexerConfig {
  INDEXER_TYPE: EnhancedIndexerType;
  ENDPOINT: string;
  TARGET_ADDRESSES?: string[];
  TRANSACTION_FILTER?: TransactionSubscribeFilter;
  TRANSACTION_OPTIONS?: TransactionSubscribeOptions;
  ACCOUNT_OPTIONS?: AccountSubscribeOptions;
}

export function loadEnhancedIndexerConfig(): EnhancedIndexerConfig {
  const endpoint = process.env.WS_ENDPOINT;
  if (!endpoint) throw new Error("Missing WS_ENDPOINT in .env");

  const indexerType = 
    EnhancedIndexerType[
      (process.env.ENHANCED_INDEXER_TYPE?.toUpperCase() as keyof typeof EnhancedIndexerType)
    ] ?? EnhancedIndexerType.TRANSACTION;

  const targets = 
    process.env.TARGET_ADDRESSES
      ?.split(",")
      .map((a) => a.trim())
      .filter(Boolean) ?? [];

  if (!targets.length && indexerType === EnhancedIndexerType.TRANSACTION) {
    console.warn("[WARN] No TARGET_ADDRESSES found — transaction indexer will start idle.");
  }

  // Transaction filter options
  const transactionFilter: TransactionSubscribeFilter = {
    vote: process.env.FILTER_VOTE === "true",
    failed: process.env.FILTER_FAILED === "true",
    accountInclude: targets.length > 0 ? targets : undefined,
  };

  // Transaction subscription options
  const transactionOptions: TransactionSubscribeOptions = {
    commitment: (process.env.COMMITMENT as any) || "confirmed",
    encoding: (process.env.ENCODING as any) || "jsonParsed",
    transactionDetails: (process.env.TRANSACTION_DETAILS as any) || "full",
    showRewards: process.env.SHOW_REWARDS === "true",
    maxSupportedTransactionVersion: 
      parseInt(process.env.MAX_SUPPORTED_TX_VERSION || "0"),
  };

  // Account subscription options
  const accountOptions: AccountSubscribeOptions = {
    encoding: (process.env.ENCODING as any) || "jsonParsed",
    commitment: (process.env.COMMITMENT as any) || "confirmed",
  };

  return {
    INDEXER_TYPE: indexerType,
    ENDPOINT: endpoint,
    TARGET_ADDRESSES: targets,
    TRANSACTION_FILTER: transactionFilter,
    TRANSACTION_OPTIONS: transactionOptions,
    ACCOUNT_OPTIONS: accountOptions,
  };
}