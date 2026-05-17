// ---------------------------------------------------------------------------
// Well-known address labels by chain ID
// ---------------------------------------------------------------------------

const labelsByChain: Record<number, Record<string, string>> = {
  1: {
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": "DAI",
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D": "Uniswap V2 Router",
    "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B": "Uniswap V2 Router 2",
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45": "Uniswap V3 Router",
    "0xDef1C0ded9bec7F1a1670819833240f027b25EfF": "0x: Exchange Proxy",
    "0x1111111254EEB25477B68fb85Ed929f73A960582": "1inch Aggregation Router",
    "0x5c4e43e8c58644bA3a07f7A1A6fE7eC591b01E62": "Uniswap Universal Router",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
    "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE": "SHIB",
    "0x514910771AF9Ca656af840dff83E8264EcF986CA": "LINK",
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": "UNI",
    "0x6982508145454Ce325dDbE47a25d4ec3d2311933": "PEPE",
  },
  42161: {
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": "USDT",
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": "WETH",
    "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 SwapRouter",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
  },
  10: {
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x7F5c764cBc14f9669B88837ca1490cCa17c31607": "USDC",
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58": "USDT",
    "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 SwapRouter",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
  },
  8453: {
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC",
    "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA": "USDbC",
    "0x2626664c2603336E57B271c5C0b26F421741e481": "USDT",
    "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 SwapRouter",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
  },
  137: {
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619": "WETH",
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": "USDC",
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": "USDT",
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff": "QuickSwap Router",
    "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 SwapRouter",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
  },
  56: {
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": "WBNB",
    "0x55d398326f99059fF775485246999027B3197955": "USDT",
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": "USDC",
    "0x10ED43C718714eb63d5aA57B78B54704E256024E": "PancakeSwap Router V2",
    "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4": "PancakeSwap Router V3",
    "0xcee4a0b4de6c97a5b944d9a1c191fccd5ad9e6d0": "Multicall3",
  },
};

// User-defined labels stored in localStorage
const USER_LABELS_KEY = "user-address-labels";

interface UserLabel {
  address: string;
  chainId: number;
  label: string;
}

function loadUserLabels(): UserLabel[] {
  try {
    const raw = localStorage.getItem(USER_LABELS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserLabels(labels: UserLabel[]): void {
  localStorage.setItem(USER_LABELS_KEY, JSON.stringify(labels));
}

export function getAddressLabel(address: string, chainId: number): string | undefined {
  const lower = address.toLowerCase();
  const chainLabels = labelsByChain[chainId];
  if (chainLabels) {
    for (const [addr, label] of Object.entries(chainLabels)) {
      if (addr.toLowerCase() === lower) return label;
    }
  }
  const userLabels = loadUserLabels();
  const found = userLabels.find(
    (l) => l.address.toLowerCase() === lower && l.chainId === chainId,
  );
  return found?.label;
}

export function setAddressLabel(address: string, chainId: number, label: string): void {
  const lower = address.toLowerCase();
  const labels = loadUserLabels().filter(
    (l) => !(l.address.toLowerCase() === lower && l.chainId === chainId),
  );
  labels.push({ address: lower, chainId, label });
  saveUserLabels(labels);
}

export function removeAddressLabel(address: string, chainId: number): void {
  const lower = address.toLowerCase();
  const labels = loadUserLabels().filter(
    (l) => !(l.address.toLowerCase() === lower && l.chainId === chainId),
  );
  saveUserLabels(labels);
}
