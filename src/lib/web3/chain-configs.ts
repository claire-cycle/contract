// ---------------------------------------------------------------------------
// Chain display configuration (name, color, explorer URL, native currency)
// ---------------------------------------------------------------------------

export interface ChainConfig {
  name: string
  icon: string
  blockExplorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  color: string
}

export const chainConfigMap: Record<number, ChainConfig> = {
  1: {
    name: 'Ethereum',
    icon: '/chains/ethereum.svg',
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    color: '#627EEA',
  },
  42161: {
    name: 'Arbitrum',
    icon: '/chains/arbitrum.svg',
    blockExplorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    color: '#28A0F0',
  },
  10: {
    name: 'Optimism',
    icon: '/chains/optimism.svg',
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    color: '#FF0420',
  },
  8453: {
    name: 'Base',
    icon: '/chains/base.svg',
    blockExplorerUrl: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    color: '#0052FF',
  },
  137: {
    name: 'Polygon',
    icon: '/chains/polygon.svg',
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    color: '#8247E5',
  },
  56: {
    name: 'BSC',
    icon: '/chains/bsc.svg',
    blockExplorerUrl: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    color: '#F3BA2F',
  },
}
