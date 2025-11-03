import { IndexerType } from "./IndexerTypes";

export interface IndexerConfig {
  INDEXER_TYPE: IndexerType;
  ENDPOINT: string;
  TARGET_ADDRESSES?: string[];
}

export function loadIndexerConfig(): IndexerConfig {
  const endpoint = process.env.WS_ENDPOINT!;
  const indexerType =
    IndexerType[(process.env.INDEXER_TYPE?.toUpperCase() as keyof typeof IndexerType)] ??
    IndexerType.PROGRAM;
  
  const targets =
    process.env.TARGET_ADDRESSES?.split(",").map((a) => a.trim()).filter(Boolean) ?? [];

  if (!endpoint) throw new Error("Missing WS_ENDPOINT in .env");
  if (!targets.length)
    console.warn("[WARN] No TARGET_ADDRESSES found — indexer will start idle.");

  return { ENDPOINT: endpoint, INDEXER_TYPE: indexerType, TARGET_ADDRESSES: targets };
}
