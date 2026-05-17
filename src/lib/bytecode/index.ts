// ---------------------------------------------------------------------------
// Bytecode Analysis – Public API
// Re-exports all sub-modules and provides the high-level BytecodeAnalyzer.
// ---------------------------------------------------------------------------

import { getPublicClient } from '@/lib/web3'
import { extractSelectors, extractJumps, type SelectorMatch, type JumpDest } from './disassembler'
import { detectProxy, type ProxyInfo } from './proxy-detector'
import { lookupSelector, getSelectorHash, type SelectorResult } from './selectors/4byte-directory'

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { extractSelectors, extractJumps } from './disassembler'
export type { SelectorMatch, JumpDest } from './disassembler'

export { detectProxy } from './proxy-detector'
export type { ProxyInfo } from './proxy-detector'

export { lookupSelector, getSelectorHash } from './selectors/4byte-directory'
export type { SelectorResult } from './selectors/4byte-directory'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedSelector {
  /** 0x-prefixed 4-byte hex selector */
  selector: string
  /** Human-readable function signature (if resolved) */
  signature?: string
  /** Confidence of the signature match */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  /** Where the signature came from */
  source: string
}

export interface BytecodeAnalysisResult {
  /** Raw bytecode hex string */
  bytecode: string
  /** Resolved function selectors */
  selectors: ResolvedSelector[]
  /** Proxy detection result */
  proxyInfo: ProxyInfo
  /** Optional contract type classification */
  contractType?: string
}

// ---------------------------------------------------------------------------
// BytecodeAnalyzer
// ---------------------------------------------------------------------------

export class BytecodeAnalyzer {
  // -----------------------------------------------------------------------
  // analyse
  // -----------------------------------------------------------------------

  /**
   * Perform a full bytecode analysis for a contract at the given address.
   *
   * Steps:
   * 1. Fetch bytecode from the chain via `eth_getCode`.
   * 2. Extract function selectors from the bytecode.
   * 3. Detect whether the contract is a proxy.
   * 4. If it is a proxy, resolve the implementation address and re-fetch
   *    bytecode from the implementation.
   * 5. Query 4byte.directory / OpenChain for each selector signature.
   * 6. Classify the contract type.
   */
  async analyse(
    address: string,
    chainId: number,
    customRpc?: string,
    customChainMeta?: {
      name: string;
      nativeCurrencySymbol: string;
      nativeCurrencyDecimals: number;
    },
  ): Promise<BytecodeAnalysisResult> {
    const client = getPublicClient(chainId, customRpc, customChainMeta)

    // 1. Fetch bytecode
    let bytecode = await client.getCode({ address: address as `0x${string}` })

    if (!bytecode || bytecode === '0x') {
      return {
        bytecode: '0x',
        selectors: [],
        proxyInfo: { isProxy: false },
        contractType: 'EMPTY',
      }
    }

    // 2. Detect proxy
    const getAddress = async (slot: string): Promise<string | null> => {
      try {
        const value = await client.getStorageAt({
          address: address as `0x${string}`,
          slot: slot as `0x${string}`,
        })
        return value ?? null
      } catch {
        return null
      }
    }

    const proxyInfo = await detectProxy(bytecode, getAddress)

    // 3. If proxy, try to fetch implementation bytecode
    if (proxyInfo.isProxy && proxyInfo.implementationAddress) {
      const implBytecode = await client.getCode({
        address: proxyInfo.implementationAddress as `0x${string}`,
      })

      if (implBytecode && implBytecode !== '0x') {
        bytecode = implBytecode
      }
    }

    // 4. Extract selectors from the (possibly implementation) bytecode
    const rawSelectors = extractSelectors(bytecode)

    // 5. Resolve selector signatures
    const selectors = await this.resolveSelectors(rawSelectors)

    // 6. Classify contract type
    const contractType = this.classifyContract(proxyInfo, selectors)

    return {
      bytecode,
      selectors,
      proxyInfo,
      contractType,
    }
  }

  // -----------------------------------------------------------------------
  // resolveSelectors
  // -----------------------------------------------------------------------

  private async resolveSelectors(
    raw: SelectorMatch[],
  ): Promise<ResolvedSelector[]> {
    const results: ResolvedSelector[] = []

    for (const { selector } of raw) {
      try {
        const lookup = await lookupSelector(selector)

        if (lookup) {
          results.push({
            selector,
            signature: lookup.signature,
            confidence: lookup.confidence,
            source: lookup.confidence === 'HIGH' ? '4byte.directory' : 'OpenChain',
          })
        } else {
          results.push({
            selector,
            confidence: 'LOW',
            source: 'unresolved',
          })
        }
      } catch {
        results.push({
          selector,
          confidence: 'LOW',
          source: 'error',
        })
      }
    }

    return results
  }

  // -----------------------------------------------------------------------
  // classifyContract
  // -----------------------------------------------------------------------

  private classifyContract(
    proxyInfo: ProxyInfo,
    selectors: ResolvedSelector[],
  ): string {
    // Proxy types
    if (proxyInfo.isProxy) {
      if (proxyInfo.type?.includes('EIP-1167')) return 'Minimal Proxy'
      if (proxyInfo.type?.includes('Beacon')) return 'Beacon Proxy'
      if (proxyInfo.type?.includes('Transparent')) return 'Transparent Proxy'
      if (proxyInfo.type?.includes('EIP-1967')) return 'UUPS/Proxy'
      return 'Proxy'
    }

    // Heuristic: ERC-20 contracts always have these selectors
    const sigSet = new Set(selectors.map((s) => s.signature))
    const hasTransfer = sigSet.has('transfer(address,uint256)')
    const hasBalanceOf = sigSet.has('balanceOf(address)')
    const hasApprove = sigSet.has('approve(address,uint256)')
    const hasAllowance = sigSet.has('allowance(address,address)')

    if (hasTransfer && hasBalanceOf && hasApprove) {
      if (hasAllowance) return 'ERC-20'
      return 'ERC-20 (minimal)'
    }

    // ERC-721
    const hasOwnerOf = sigSet.has('ownerOf(uint256)')
    const hasTokenURI = sigSet.has('tokenURI(uint256)')
    const hasSafeTransferFrom = sigSet.has('safeTransferFrom(address,address,uint256)')

    if (hasOwnerOf && hasBalanceOf && hasSafeTransferFrom) {
      if (hasTokenURI) return 'ERC-721'
      return 'ERC-721 (minimal)'
    }

    // ERC-1155
    const hasBalanceOfBatch = sigSet.has('balanceOfBatch(address[],uint256[])')
    const hasSafeBatchTransfer = sigSet.has(
      'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
    )

    if (hasBalanceOfBatch && hasSafeBatchTransfer) {
      return 'ERC-1155'
    }

    // Generic
    if (selectors.length > 0) {
      return 'Contract'
    }

    return 'Unknown'
  }
}
