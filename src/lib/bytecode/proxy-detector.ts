// ---------------------------------------------------------------------------
// Proxy Contract Detector
// Identifies well-known proxy patterns from deployed bytecode.
// ---------------------------------------------------------------------------

export interface ProxyInfo {
  isProxy: boolean
  /** Human-readable proxy type label, e.g. "EIP-1967", "EIP-1167" */
  type?: string
  /** Resolved implementation address (if statically embedded) */
  implementationAddress?: string
}

// ---------------------------------------------------------------------------
// Well-known storage slots
// ---------------------------------------------------------------------------

/** EIP-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1) */
const EIP1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

/** EIP-1967 beacon slot: bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1) */
const EIP1967_BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50'

/** EIP-1967 admin slot */
const EIP1967_ADMIN_SLOT =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'

// ---------------------------------------------------------------------------
// EIP-1167 minimal proxy preamble
// ---------------------------------------------------------------------------

/**
 * EIP-1167 minimal proxy contracts start with:
 *   363d3d373d3d3d363d73 <20-byte-address> 5af43d3d93803e602a57fd5bf3
 */
const EIP1167_PREFIX = '363d3d373d3d3d363d73'
const EIP1167_SUFFIX = '5af43d3d93803e602a57fd5bf3'

// ---------------------------------------------------------------------------
// OpenZeppelin transparent proxy patterns
// ---------------------------------------------------------------------------

/**
 * OpenZeppelin transparent proxies typically contain a reference to the admin
 * slot via SLOAD(ADMIN_SLOT) followed by a comparison and delegation.
 * We look for the admin slot bytes embedded in the bytecode.
 */
const OZ_ADMIN_SLOT_HEX = EIP1967_ADMIN_SLOT.slice(2).toLowerCase()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeHex(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X')
    ? hex.slice(2).toLowerCase()
    : hex.toLowerCase()
}

/**
 * Extract a 20-byte address from a hex substring at the given offset.
 */
function extractAddress(hex: string, offset: number): string | undefined {
  if (offset + 40 > hex.length) return undefined
  const addr = hex.substring(offset, offset + 40)
  // Basic validation: all hex chars
  if (/^[0-9a-f]{40}$/.test(addr)) {
    return '0x' + addr
  }
  return undefined
}

// ---------------------------------------------------------------------------
// detectProxy
// ---------------------------------------------------------------------------

/**
 * Analyse bytecode to determine whether it belongs to a known proxy pattern.
 *
 * `getAddress` is an async callback that the caller provides to read a storage
 * slot from the contract at a given address (e.g. via `eth_getStorageAt`).
 * It should return the value as a 0x-prefixed hex string, or `null` on error.
 */
export async function detectProxy(
  bytecode: string,
  getAddress: (slot: string) => Promise<string | null>,
): Promise<ProxyInfo> {
  const raw = normalizeHex(bytecode)

  // ---- 1. EIP-1167 minimal proxy (static address in bytecode) ----

  if (raw.startsWith(EIP1167_PREFIX)) {
    // The 20-byte implementation address follows the 10-byte prefix
    const implAddress = extractAddress(raw, EIP1167_PREFIX.length)

    // Validate the suffix as well
    const suffixStart = EIP1167_PREFIX.length + 40
    const hasSuffix =
      suffixStart + EIP1167_SUFFIX.length <= raw.length &&
      raw.substring(suffixStart, suffixStart + EIP1167_SUFFIX.length) ===
        EIP1167_SUFFIX

    if (implAddress) {
      return {
        isProxy: true,
        type: hasSuffix ? 'EIP-1167 Minimal Proxy' : 'EIP-1167 (variant)',
        implementationAddress: implAddress,
      }
    }
  }

  // ---- 2. EIP-1967 proxy (implementation address in storage) ----

  const implementationSlotValue = await getAddress(EIP1967_IMPLEMENTATION_SLOT)

  if (implementationSlotValue && implementationSlotValue !== '0x' + '0'.repeat(64)) {
    // The slot stores a bytes32; the address is in the last 20 bytes
    const slotRaw = normalizeHex(implementationSlotValue)
    const addressHex = slotRaw.length >= 40 ? slotRaw.slice(-40) : slotRaw
    const isNonZero = addressHex !== '0'.repeat(40)

    if (isNonZero) {
      return {
        isProxy: true,
        type: 'EIP-1967 Proxy',
        implementationAddress: '0x' + addressHex,
      }
    }
  }

  // ---- 3. EIP-1967 beacon proxy ----

  const beaconSlotValue = await getAddress(EIP1967_BEACON_SLOT)

  if (beaconSlotValue && beaconSlotValue !== '0x' + '0'.repeat(64)) {
    const slotRaw = normalizeHex(beaconSlotValue)
    const addressHex = slotRaw.length >= 40 ? slotRaw.slice(-40) : slotRaw
    const isNonZero = addressHex !== '0'.repeat(40)

    if (isNonZero) {
      return {
        isProxy: true,
        type: 'EIP-1967 Beacon Proxy',
        implementationAddress: '0x' + addressHex,
      }
    }
  }

  // ---- 4. OpenZeppelin transparent proxy (heuristic) ----

  // OZ transparent proxies embed the admin slot hash in their bytecode.
  // They also reference the implementation slot. If we find both patterns
  // in the bytecode, we classify it as an OZ transparent proxy.
  if (raw.includes(OZ_ADMIN_SLOT_HEX)) {
    const implSlotHex = EIP1967_IMPLEMENTATION_SLOT.slice(2).toLowerCase()
    if (raw.includes(implSlotHex)) {
      // Try to read the implementation address from storage
      if (implementationSlotValue) {
        const slotRaw = normalizeHex(implementationSlotValue)
        const addressHex = slotRaw.length >= 40 ? slotRaw.slice(-40) : slotRaw
        const isNonZero = addressHex !== '0'.repeat(40)

        if (isNonZero) {
          return {
            isProxy: true,
            type: 'OpenZeppelin Transparent Proxy',
            implementationAddress: '0x' + addressHex,
          }
        }
      }

      return {
        isProxy: true,
        type: 'OpenZeppelin Transparent Proxy',
      }
    }
  }

  // ---- 5. Generic delegate-call proxy heuristic ----

  // If the bytecode contains DELEGATECALL (0xf4) and very little code, it is
  // likely some form of proxy. This is a loose heuristic.
  const delegateCallIndex = raw.indexOf('f4')
  const hasSstore = raw.includes('55') // SSTORE
  const codeSize = raw.length / 2

  // Very small contracts (< 200 bytes) with a DELEGATECALL are almost
  // certainly proxies.
  if (delegateCallIndex !== -1 && codeSize < 200 && !hasSstore) {
    // Try to extract an address from a PUSH20 following DELEGATECALL pattern
    const push20 = '73' // PUSH20
    const push20Idx = raw.indexOf(push20)
    if (push20Idx !== -1) {
      const implAddress = extractAddress(raw, push20Idx + 2)
      if (implAddress && implAddress !== '0x' + '0'.repeat(40)) {
        return {
          isProxy: true,
          type: 'Delegate-call Proxy',
          implementationAddress: implAddress,
        }
      }
    }

    return {
      isProxy: true,
      type: 'Delegate-call Proxy (generic)',
    }
  }

  // Not a proxy
  return { isProxy: false }
}
