const CHAIN_TO_API_URL: Record<number, string> = {
  1: "https://api.etherscan.io",
  42161: "https://api.arbiscan.io",
  10: "https://api.optimistic.etherscan.io",
  8453: "https://api.basescan.org",
  137: "https://api.polygonscan.com",
  56: "https://api.bscscan.com",
};

interface EtherscanResponse {
  status: string;
  message: string;
  result: string;
}

export async function fetchAbiFromEtherscan(
  address: string,
  chainId: number,
  apiKey?: string
): Promise<string> {
  const baseUrl = CHAIN_TO_API_URL[chainId];
  if (!baseUrl) {
    throw new Error("Unsupported chain for Etherscan ABI fetch");
  }

  const url = `${baseUrl}/api?module=contract&action=getabi&address=${address}&apikey=${apiKey || ""}`;

  const response = await fetch(url);
  const data: EtherscanResponse = await response.json();

  if (data.status === "1") {
    return data.result;
  }

  throw new Error(data.result || "Failed to fetch ABI from Etherscan");
}
