// =============================================================================
// Web3 Contract Tool - TypeScript Type Definitions
// =============================================================================

// ---------------------------------------------------------------------------
// Chain Types
// ---------------------------------------------------------------------------

export type SupportedChainId = 1 | 42161 | 10 | 8453 | 137 | 56;

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  icon: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: NativeCurrency;
  color: string;
}

// ---------------------------------------------------------------------------
// Wallet Types
// ---------------------------------------------------------------------------

export type WalletState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletConnection {
  address: string;
  chainId: SupportedChainId;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Contract Types
// ---------------------------------------------------------------------------

export interface ContractInfo {
  id: string;
  address: string;
  chainId: SupportedChainId;
  name?: string;
  abi?: AbiMethod[];
  bytecode?: string;
  isVerified: boolean;
  createdAt: number;
}

export interface AbiParam {
  name: string;
  type: string;
  components?: AbiParam[];
}

export interface AbiMethod {
  name: string;
  type: string;
  inputs: AbiParam[];
  outputs: AbiParam[];
  stateMutability: string;
}

export interface CallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  decoded?: unknown;
}

// ---------------------------------------------------------------------------
// AI Types
// ---------------------------------------------------------------------------

export type AIProvider = 'claude' | 'openai' | 'ollama';

export type AIConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AIModel {
  provider: AIProvider;
  modelId: string;
  name: string;
}

export interface AIAnalysisResult {
  type: string;
  content: string;
  confidence: AIConfidence;
  suggestions: string[];
  timestamp: number;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  ollamaUrl?: string;
  modelId: string;
}

// ---------------------------------------------------------------------------
// Bytecode Types
// ---------------------------------------------------------------------------

export interface FunctionSelector {
  selector: string;
  signature?: string;
  confidence: number;
  source: string;
}

export interface ProxyInfo {
  isProxy: boolean;
  type?: string;
  implementationAddress?: string;
}

export interface BytecodeAnalysis {
  bytecode: string;
  selectors: FunctionSelector[];
  proxyInfo: ProxyInfo;
  contractType?: string;
  events: string[];
}

// ---------------------------------------------------------------------------
// History Types
// ---------------------------------------------------------------------------

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface TransactionRecord {
  id: string;
  hash: string;
  from: string;
  to: string;
  chainId: SupportedChainId;
  value: string;
  data: string;
  method?: string;
  timestamp: number;
  status: TransactionStatus;
  gasUsed?: string;
}

// ---------------------------------------------------------------------------
// Settings Types
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: Theme;
  defaultChainId: SupportedChainId;
  customRpcs: Map<SupportedChainId, string>;
  aiConfig: AIConfig;
}

// ---------------------------------------------------------------------------
// UI Types
// ---------------------------------------------------------------------------

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}
