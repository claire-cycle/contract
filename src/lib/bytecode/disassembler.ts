// ---------------------------------------------------------------------------
// EVM Bytecode Disassembler
// Extracts function selectors and jump destinations from contract bytecode.
// ---------------------------------------------------------------------------

export interface SelectorMatch {
  /** 0x-prefixed 4-byte hex selector */
  selector: string
  /** Program counter (byte offset) where the PUSH4 was found */
  pc: number
}

export interface JumpDest {
  /** Jump destination offset */
  offset: number
  /** Byte offset where this JUMPDEST opcode lives */
  pc: number
}

// ---------------------------------------------------------------------------
// Opcode constants
// ---------------------------------------------------------------------------

const PUSH1 = 0x60
const PUSH32 = 0x7f
const JUMP = 0x56
const JUMPI = 0x57
const JUMPDEST = 0x5b
const PUSH4 = 0x63

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a hex string – strips optional 0x prefix, lower-cases.
 */
function normalizeHex(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X')
    ? hex.slice(2).toLowerCase()
    : hex.toLowerCase()
}

// ---------------------------------------------------------------------------
// extractSelectors
// ---------------------------------------------------------------------------

/**
 * Scan bytecode for PUSH4 (0x63) opcodes and return every 4-byte value that
 * looks like a function selector.
 *
 * Heuristics used to filter out false-positives:
 *  - Skip selectors that appear immediately after a JUMPI (0x57) because they
 *    are typically comparison / branch-target constants, not selectors.
 *  - Skip selectors that are followed by a JUMPDEST (0x5b) without an
 *    intervening comparison, because a selector is usually followed by an
 *    EQ / LT / GT comparison before the JUMPDEST.
 *  - Deduplicate by selector value, keeping the lowest pc.
 */
export function extractSelectors(bytecode: string): SelectorMatch[] {
  const raw = normalizeHex(bytecode)
  const bytes: number[] = []

  for (let i = 0; i < raw.length; i += 2) {
    bytes.push(parseInt(raw.substring(i, i + 2), 16))
  }

  const candidates: SelectorMatch[] = []
  const seen = new Set<string>()
  let pc = 0

  while (pc < bytes.length) {
    const opcode = bytes[pc]

    // --- PUSH4 ---
    if (opcode === PUSH4 && pc + 4 < bytes.length) {
      const selectorBytes = bytes.slice(pc + 1, pc + 5)
      const selector =
        '0x' + selectorBytes.map((b) => b.toString(16).padStart(2, '0')).join('')

      // Heuristic: skip if the previous opcode was JUMPI (comparison value)
      const prevOpcode = pc > 0 ? bytes[pc - 1] : 0x00
      if (prevOpcode === JUMPI) {
        pc += 5 // skip PUSH4 + 4 data bytes
        continue
      }

      // Heuristic: look ahead – a genuine selector is almost always followed by
      // EQ (0x14) or used in a comparison before a JUMPDEST. If the byte right
      // after the 4 data bytes is a JUMPDEST, this is likely a hardcoded offset,
      // not a selector.
      const afterDataPc = pc + 5
      if (afterDataPc < bytes.length && bytes[afterDataPc] === JUMPDEST) {
        pc += 5
        continue
      }

      // Heuristic: if the previous opcode was another PUSH (data region),
      // the value is probably an inline constant, not a selector.
      if (prevOpcode >= PUSH1 && prevOpcode <= PUSH32) {
        pc += 5
        continue
      }

      if (!seen.has(selector)) {
        seen.add(selector)
        candidates.push({ selector, pc })
      }
    }

    // Advance past PUSH data
    if (opcode >= PUSH1 && opcode <= PUSH32) {
      const n = opcode - PUSH1 + 1 // number of data bytes
      pc += 1 + n
    } else {
      pc += 1
    }
  }

  return candidates
}

// ---------------------------------------------------------------------------
// extractJumps
// ---------------------------------------------------------------------------

/**
 * Walk the bytecode and collect all JUMPDEST locations as well as the
 * immediate values pushed before JUMP / JUMPI instructions (i.e. jump
 * targets).
 *
 * Returns an array of unique jump destinations useful for control-flow
 * analysis.
 */
export function extractJumps(bytecode: string): JumpDest[] {
  const raw = normalizeHex(bytecode)
  const bytes: number[] = []

  for (let i = 0; i < raw.length; i += 2) {
    bytes.push(parseInt(raw.substring(i, i + 2), 16))
  }

  const jumpdests: JumpDest[] = []
  const targets = new Set<number>()
  let pc = 0

  // Track the most recent PUSH value so we can resolve JUMP/JUMPI targets.
  let lastPushValue: number | null = null

  while (pc < bytes.length) {
    const opcode = bytes[pc]

    if (opcode === JUMPDEST) {
      jumpdests.push({ offset: pc, pc })
    }

    if (opcode === JUMP || opcode === JUMPI) {
      if (lastPushValue !== null) {
        targets.add(lastPushValue)
      }
    }

    // Record PUSH values
    if (opcode >= PUSH1 && opcode <= PUSH32) {
      const n = opcode - PUSH1 + 1
      if (pc + n < bytes.length && n <= 4) {
        // Only resolve small pushes (up to 4 bytes) as jump targets
        let value = 0
        for (let i = 0; i < n; i++) {
          value = (value << 8) | bytes[pc + 1 + i]
        }
        lastPushValue = value
      } else {
        lastPushValue = null
      }
      pc += 1 + n
    } else {
      lastPushValue = null
      pc += 1
    }
  }

  // Merge: any target that is also a JUMPDEST is a valid jump destination
  const seen = new Set<number>()
  const result: JumpDest[] = []

  for (const jd of jumpdests) {
    if (!seen.has(jd.offset)) {
      seen.add(jd.offset)
      result.push(jd)
    }
  }

  // Include targets that don't have a matching JUMPDEST (for diagnostics)
  for (const t of targets) {
    if (!seen.has(t)) {
      seen.add(t)
      result.push({ offset: t, pc: -1 })
    }
  }

  return result.sort((a, b) => a.offset - b.offset)
}
