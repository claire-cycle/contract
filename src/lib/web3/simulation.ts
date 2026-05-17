import { getPublicClient } from "./index";

export interface SimulationResult {
  success: boolean;
  gasUsed?: string;
  error?: string;
  returnValue?: string;
}

/**
 * Simulate a transaction using eth_call with from override.
 * This is a dry-run that does not actually send a transaction.
 */
export async function simulateTransaction(
  chainId: number,
  from: string,
  to: string,
  data: string,
  value?: string,
  customRpc?: string,
  customChainMeta?: {
    name: string;
    nativeCurrencySymbol: string;
    nativeCurrencyDecimals: number;
  },
): Promise<SimulationResult> {
  const publicClient = getPublicClient(chainId, customRpc, customChainMeta);

  try {
    // Estimate gas to check if the call would succeed
    const gasEstimate = await publicClient.estimateGas({
      account: from as `0x${string}`,
      to: to as `0x${string}`,
      data: data as `0x${string}`,
      ...(value && BigInt(value) > 0n ? { value: BigInt(value) } : {}),
    });

    // Also try a raw eth_call to get return value
    let returnValue: string | undefined;
    try {
      returnValue = await publicClient.call({
        account: from as `0x${string}`,
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        ...(value && BigInt(value) > 0n ? { value: BigInt(value) } : {}),
      }).then((r) => r.data ?? undefined);
    } catch {
      // return value not critical for simulation
    }

    return {
      success: true,
      gasUsed: gasEstimate.toString(),
      returnValue,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return {
      success: false,
      error: message,
    };
  }
}
