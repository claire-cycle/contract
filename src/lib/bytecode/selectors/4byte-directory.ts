// ---------------------------------------------------------------------------
// 4-byte Directory / OpenChain Selector Lookup
// Resolves 4-byte function selectors to human-readable signatures.
// ---------------------------------------------------------------------------

import { keccak256, toBytes } from 'viem'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectorResult {
  /** Full function signature, e.g. "transfer(address,uint256)" */
  signature: string
  /** Confidence level of the match */
  confidence: 'HIGH' | 'MEDIUM'
}

// ---------------------------------------------------------------------------
// getSelectorHash
// ---------------------------------------------------------------------------

/**
 * Compute the 4-byte function selector for a given human-readable signature.
 *
 * Example: `getSelectorHash("transfer(address,uint256)")` returns the first
 * 4 bytes of `keccak256("transfer(address,uint256)")` as a `0x`-prefixed hex
 * string.
 */
export function getSelectorHash(signature: string): string {
  const hash = keccak256(toBytes(signature))
  // hash is 0x-prefixed 32-byte hex; take first 4 bytes (8 hex chars + 0x)
  return hash.slice(0, 10)
}

// ---------------------------------------------------------------------------
// 4byte.directory lookup
// ---------------------------------------------------------------------------

interface FourByteResult {
  id: number
  created_at: string
  text_signature: string
  hex_signature: string
  bytes_signature: string
}

async function lookupFourByte(selector: string): Promise<string | null> {
  try {
    const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const data = await response.json()

    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      // Sort by id ascending (earliest registered = most common / reliable)
      const sorted: FourByteResult[] = data.results.sort(
        (a: FourByteResult, b: FourByteResult) => a.id - b.id,
      )
      return sorted[0].text_signature
    }

    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// OpenChain lookup
// ---------------------------------------------------------------------------

async function lookupOpenChain(selector: string): Promise<string | null> {
  try {
    const url = `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const data = await response.json()
    const results = data?.result?.function

    if (results && results[selector] && Array.isArray(results[selector])) {
      const entries = results[selector]
      if (entries.length > 0) {
        // entries are { name: string } objects
        return entries[0].name ?? null
      }
    }

    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// lookupSelector (main export)
// ---------------------------------------------------------------------------

/**
 * Look up a 4-byte function selector against external signature databases.
 *
 * Tries 4byte.directory first (HIGH confidence), then falls back to OpenChain
 * (MEDIUM confidence because it aggregates crowd-sourced data with less
 * vetting).
 *
 * Returns `null` when neither source returns a result.
 */
export async function lookupSelector(
  selector: string,
): Promise<SelectorResult | null> {
  // Normalise selector
  const normalized = selector.startsWith('0x') ? selector : '0x' + selector

  // Try 4byte.directory first
  const fourByteSig = await lookupFourByte(normalized)
  if (fourByteSig) {
    return {
      signature: fourByteSig,
      confidence: 'HIGH',
    }
  }

  // Fall back to OpenChain
  const openChainSig = await lookupOpenChain(normalized)
  if (openChainSig) {
    return {
      signature: openChainSig,
      confidence: 'MEDIUM',
    }
  }

  return null
}
