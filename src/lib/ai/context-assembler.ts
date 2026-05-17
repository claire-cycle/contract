// ---------------------------------------------------------------------------
// Context assembler
// Builds a comprehensive text context from on-chain data for AI consumption
// ---------------------------------------------------------------------------

interface SelectorEntry {
  selector: string;
  signature?: string;
  confidence: string;
}

interface ProxyInfo {
  isProxy: boolean;
  type?: string;
  implementationAddress?: string;
}

interface Transaction {
  from: string;
  to: string;
  data: string;
  value: string;
}

interface AssembleParams {
  bytecode: string;
  selectors: SelectorEntry[];
  proxyInfo: ProxyInfo;
  recentTransactions?: Transaction[];
}

/**
 * Assemble a comprehensive text context from all on-chain data.
 * This context is suitable for inclusion in AI prompts as reference material.
 */
export function assembleBytecodeContext(params: AssembleParams): string {
  const { bytecode, selectors, proxyInfo, recentTransactions } = params;
  const sections: string[] = [];

  // ---- Bytecode summary ----
  sections.push('=== BYTECODE SUMMARY ===');
  const bytecodeSize = (bytecode.length - 2) / 2; // subtract 0x prefix, hex pairs = bytes
  sections.push(`Bytecode length: ${bytecodeSize} bytes`);

  // Extract opcodes hint from common patterns
  if (bytecode.includes('363d3d373d3d3d363d73')) {
    sections.push('Pattern detected: Minimal proxy (EIP-1167 clone)');
  }
  if (bytecode.includes('365f5fa3')) {
    sections.push('Pattern detected: Proxy with fallback delegate');
  }
  sections.push(`Bytecode (first 200 chars): ${bytecode.slice(0, 200)}${bytecode.length > 200 ? '...' : ''}`);
  sections.push('');

  // ---- Selector table ----
  sections.push('=== FUNCTION SELECTOR TABLE ===');
  sections.push('Selector   | Signature                              | Confidence');
  sections.push('-----------|----------------------------------------|------------');
  for (const sel of selectors) {
    const selectorCol = sel.selector.padEnd(10);
    const sigCol = (sel.signature ?? 'UNKNOWN').padEnd(40).slice(0, 40);
    const confCol = sel.confidence;
    sections.push(`${selectorCol} | ${sigCol} | ${confCol}`);
  }
  sections.push('');

  // ---- Proxy info ----
  sections.push('=== PROXY INFORMATION ===');
  if (proxyInfo.isProxy) {
    sections.push(`Proxy: YES`);
    sections.push(`Type: ${proxyInfo.type ?? 'unknown'}`);
    if (proxyInfo.implementationAddress) {
      sections.push(`Implementation: ${proxyInfo.implementationAddress}`);
    }
  } else {
    sections.push('Proxy: NO');
  }
  sections.push('');

  // ---- Recent transactions ----
  if (recentTransactions && recentTransactions.length > 0) {
    sections.push('=== RECENT TRANSACTION PATTERNS ===');
    sections.push(`Total transactions analyzed: ${recentTransactions.length}`);

    // Extract selectors from transaction data
    const txSelectors = new Map<string, number>();
    for (const tx of recentTransactions) {
      if (tx.data && tx.data.length >= 10) {
        const sel = tx.data.slice(0, 10);
        txSelectors.set(sel, (txSelectors.get(sel) ?? 0) + 1);
      } else if (!tx.data || tx.data === '0x') {
        txSelectors.set('(no data / ETH transfer)', (txSelectors.get('(no data / ETH transfer)') ?? 0) + 1);
      }
    }

    sections.push('\nSelector call frequency:');
    const sorted = [...txSelectors.entries()].sort((a, b) => b[1] - a[1]);
    for (const [sel, count] of sorted) {
      const matchedSignature = selectors.find(
        (s) => s.selector === sel,
      )?.signature;
      const label = matchedSignature ? ` (${matchedSignature})` : '';
      sections.push(`  ${sel}: ${count} calls${label}`);
    }

    // Value distribution
    const totalValue = recentTransactions.reduce((sum, tx) => {
      try {
        return sum + BigInt(tx.value);
      } catch {
        return sum;
      }
    }, BigInt(0));

    if (totalValue > BigInt(0)) {
      sections.push(`\nTotal ETH value in recent transactions: ${totalValue.toString()} wei`);
    }

    // Unique callers
    const uniqueCallers = new Set(recentTransactions.map((tx) => tx.from));
    sections.push(`Unique callers: ${uniqueCallers.size}`);
    if (uniqueCallers.size <= 10) {
      for (const addr of uniqueCallers) {
        sections.push(`  - ${addr}`);
      }
    }
  }

  return sections.join('\n');
}
