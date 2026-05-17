import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, optimism, base, polygon, bsc, type Chain } from 'wagmi/chains'
import { createPublicClient, http as viemHttp, type PublicClient } from 'viem'
import { defineChain } from 'viem'
import { chainConfigMap as builtInConfigMap, type ChainConfig } from './chain-configs'

// ---------------------------------------------------------------------------
// Built-in supported chains
// ---------------------------------------------------------------------------

export const supportedChains = [mainnet, arbitrum, optimism, base, polygon, bsc] as const

// ---------------------------------------------------------------------------
// Chain ID type (built-in)
// ---------------------------------------------------------------------------

export type SupportedChainId =
  | typeof mainnet.id
  | typeof arbitrum.id
  | typeof optimism.id
  | typeof base.id
  | typeof polygon.id
  | typeof bsc.id

// Re-export chain config types and map
export { chainConfigMap, type ChainConfig } from './chain-configs'

// ---------------------------------------------------------------------------
// Wagmi config (built-in chains)
// ---------------------------------------------------------------------------

export const config = createConfig({
  chains: supportedChains,
  transports: {
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [base.id]: http('https://mainnet.base.org'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return builtInConfigMap[chainId as SupportedChainId]
}

const rpcUrls: Record<number, string> = {
  [mainnet.id]: 'https://eth.llamarpc.com',
  [arbitrum.id]: 'https://arb1.arbitrum.io/rpc',
  [optimism.id]: 'https://mainnet.optimism.io',
  [base.id]: 'https://mainnet.base.org',
  [polygon.id]: 'https://polygon-rpc.com',
  [bsc.id]: 'https://bsc-dataseed.binance.org',
}

/**
 * Get a viem PublicClient for any chain (built-in or custom).
 * For built-in chains, uses the known RPC (or customRpcs override).
 * For custom chains, creates an ad-hoc viem chain definition.
 */
export function getPublicClient(chainId: number, customRpc?: string, customChainMeta?: {
  name: string;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals: number;
}): PublicClient {
  // Built-in chain
  const builtIn = supportedChains.find((c) => c.id === chainId)
  if (builtIn) {
    const rpc = customRpc || rpcUrls[chainId]
    return createPublicClient({
      chain: builtIn,
      transport: viemHttp(rpc),
    }) as PublicClient
  }

  // Custom chain — build an ad-hoc viem Chain
  if (!customRpc) {
    throw new Error(`Custom chain ${chainId} requires an RPC URL`)
  }

  const chain: Chain = defineChain({
    id: chainId,
    name: customChainMeta?.name || `Chain ${chainId}`,
    nativeCurrency: {
      name: customChainMeta?.nativeCurrencySymbol || 'ETH',
      symbol: customChainMeta?.nativeCurrencySymbol || 'ETH',
      decimals: customChainMeta?.nativeCurrencyDecimals ?? 18,
    },
    rpcUrls: {
      default: { http: [customRpc] },
    },
    blockExplorers: {
      default: { name: 'Explorer', url: '' },
    },
  })

  return createPublicClient({
    chain,
    transport: viemHttp(customRpc),
  })
}

/**
 * Get all available chains (built-in + custom) for display purposes.
 * Returns a merged list of chain configs.
 */
export function getAllChainConfigs(customChains: { id: number; name: string; color: string; nativeCurrencySymbol: string; blockExplorerUrl: string }[]): Record<number, ChainConfig> {
  const result: Record<number, ChainConfig> = { ...builtInConfigMap }
  for (const cc of customChains) {
    result[cc.id] = {
      name: cc.name,
      icon: '',
      blockExplorerUrl: cc.blockExplorerUrl,
      nativeCurrency: {
        name: cc.nativeCurrencySymbol,
        symbol: cc.nativeCurrencySymbol,
        decimals: 18,
      },
      color: cc.color,
    }
  }
  return result
}
