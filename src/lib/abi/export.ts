export interface ResolvedSelector {
  selector: string;
  signature?: string;
  confidence: number;
  source: string;
}

/**
 * Convert resolved selectors into a standard ABI JSON array.
 * Only includes selectors that have a resolved signature.
 */
export function selectorsToAbiJson(selectors: ResolvedSelector[]): string {
  const abi = selectors
    .filter((s) => s.signature)
    .map((s) => {
      const sig = s.signature!;
      // Parse "functionName(type1,type2,...)" or "functionName(type1,type2,...)(retType1,...)"
      const match = sig.match(/^(\w+)\(([^)]*)\)(?:\(([^)]*)\))?$/);
      if (!match) return null;

      const name = match[1];
      const inputTypes = match[2] ? match[2].split(",").filter(Boolean) : [];
      const outputTypes = match[3] ? match[3].split(",").filter(Boolean) : [];

      return {
        name,
        type: "function",
        inputs: inputTypes.map((t, i) => ({ name: `param${i}`, type: t.trim() })),
        outputs: outputTypes.map((t, i) => ({ name: ``, type: t.trim() })),
        stateMutability: "view", // default assumption
      };
    })
    .filter(Boolean);

  return JSON.stringify(abi, null, 2);
}
