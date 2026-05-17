// ---------------------------------------------------------------------------
// AI result parser
// Parses raw AI response text into structured, typed data
// ---------------------------------------------------------------------------

import { keccak256, toBytes, toHex } from 'viem';

// ---- Parsed types ----

export interface ParsedFunction {
  selector: string;
  inferredName: string;
  params: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export interface ParsedBytecodeAnalysis {
  contractType: string;
  functions: ParsedFunction[];
  summary: string;
}

// ---- JSON block extraction ----

/**
 * Attempt to extract a JSON object from the AI response.
 * Looks for ```json ... ``` blocks first, then falls back to finding
 * the first balanced { ... } in the text.
 */
function extractJsonBlock(raw: string): string | null {
  // Strategy 1: Look for ```json ... ``` code fence
  const jsonFenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim();
  }

  // Strategy 2: Look for any ``` ... ``` code block
  const fenceMatch = raw.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const content = fenceMatch[1].trim();
    if (content.startsWith('{') || content.startsWith('[')) {
      return content;
    }
  }

  // Strategy 3: Find the first balanced { ... }
  const startIdx = raw.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  for (let i = startIdx; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    if (raw[i] === '}') depth--;
    if (depth === 0) {
      return raw.slice(startIdx, i + 1);
    }
  }

  return null;
}

// ---- Confidence normalization ----

function normalizeConfidence(raw: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const upper = raw.toUpperCase().trim();
  if (upper === 'HIGH' || upper === 'H') return 'HIGH';
  if (upper === 'MEDIUM' || upper === 'MED' || upper === 'M') return 'MEDIUM';
  if (upper === 'LOW' || upper === 'L') return 'LOW';
  // Default to MEDIUM for unrecognized values
  return 'MEDIUM';
}

// ---- Main parser ----

/**
 * Parse the raw AI response text into a structured bytecode analysis result.
 *
 * First attempts JSON extraction from the response. If that fails,
 * falls back to heuristic text parsing.
 */
export function parseBytecodeAnalysis(raw: string): ParsedBytecodeAnalysis {
  // Attempt JSON parse
  const jsonStr = extractJsonBlock(raw);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);

      // Validate required top-level fields
      if (parsed.contractType && parsed.functions && parsed.summary) {
        return {
          contractType: String(parsed.contractType),
          functions: Array.isArray(parsed.functions)
            ? parsed.functions.map((fn: Record<string, unknown>) => ({
                selector: String(fn.selector ?? ''),
                inferredName: String(fn.inferredName ?? fn.name ?? 'unknown'),
                params: String(fn.params ?? fn.parameters ?? ''),
                confidence: normalizeConfidence(String(fn.confidence ?? 'MEDIUM')),
                reasoning: String(fn.reasoning ?? ''),
              }))
            : [],
          summary: String(parsed.summary),
        };
      }
    } catch {
      // JSON parse failed, fall through to text parsing
    }
  }

  // Fallback: text-based heuristic parsing
  return parseFromText(raw);
}

/**
 * Heuristic text-based parsing for when JSON extraction fails.
 * Attempts to extract key information from freeform text.
 */
function parseFromText(raw: string): ParsedBytecodeAnalysis {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let contractType = 'Unknown';
  const functions: ParsedFunction[] = [];
  const summaryParts: string[] = [];

  let inSummary = false;

  for (const line of lines) {
    // Try to detect contract type
    const typeMatch = line.match(
      /contract\s*type\s*[:\-–]\s*(.+)/i,
    );
    if (typeMatch) {
      contractType = typeMatch[1].trim().replace(/[."]/g, '');
      continue;
    }

    // Try to detect summary section
    if (/summary\s*[:\-–]/i.test(line)) {
      inSummary = true;
      const afterColon = line.replace(/.*?[:\-–]\s*/, '');
      if (afterColon) summaryParts.push(afterColon);
      continue;
    }

    if (inSummary) {
      // End summary on a new section header
      if (/^[#=\-*]{2,}/.test(line) || /^[A-Z][a-z]+\s*[:\-]/.test(line)) {
        inSummary = false;
      } else {
        summaryParts.push(line);
        continue;
      }
    }

    // Try to detect function entries (e.g., "0xabcdef01: transfer(address, uint256)")
    const funcMatch = line.match(
      /^(?:\d+[\.\)\-]\s*)?`?(0x[0-9a-fA-F]{8})`?\s*[:\-–]\s*(.+)/i,
    );
    if (funcMatch) {
      const selector = funcMatch[1];
      const rest = funcMatch[2].trim();
      // Try to split name from reasoning
      const dashIdx = rest.indexOf(' - ');
      let inferredName = rest;
      let reasoning = '';
      if (dashIdx > 0) {
        inferredName = rest.slice(0, dashIdx).trim();
        reasoning = rest.slice(dashIdx + 3).trim();
      }
      functions.push({
        selector,
        inferredName,
        params: '',
        confidence: 'MEDIUM',
        reasoning,
      });
    }
  }

  return {
    contractType,
    functions,
    summary: summaryParts.join(' ').trim() || 'Unable to parse summary from AI response.',
  };
}

// ---- Selector/signature verification ----

/**
 * Verify that a function signature matches a given 4-byte selector.
 * Computes keccak256 of the signature and checks that the first 4 bytes
 * match the provided selector.
 */
export function verifySelectorSignature(
  selector: string,
  signature: string,
): boolean {
  try {
    // Normalize selector: ensure 0x prefix and 10 chars (0x + 8 hex)
    const normalizedSelector = selector.startsWith('0x')
      ? selector.toLowerCase()
      : `0x${selector}`.toLowerCase();

    if (normalizedSelector.length !== 10) return false;

    // Compute keccak256 of the function signature
    const hash = keccak256(toHex(signature));
    // First 4 bytes (8 hex chars) after 0x prefix
    const computedSelector = `0x${hash.slice(2, 10)}`.toLowerCase();

    return normalizedSelector === computedSelector;
  } catch {
    return false;
  }
}
