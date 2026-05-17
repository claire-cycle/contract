// ---------------------------------------------------------------------------
// Bytecode analysis prompt builder
// Constructs prompts for AI-powered smart contract reverse engineering
// ---------------------------------------------------------------------------

import type { AIMessage } from '../providers';

interface SelectorEntry {
  selector: string;
  signature?: string;
}

interface ProxyInfo {
  isProxy: boolean;
  type?: string;
  implementationAddress?: string;
}

interface EventEntry {
  topics: string[];
}

/**
 * Build the message array for a bytecode analysis AI query.
 *
 * The AI is asked to:
 * 1. Infer the contract type (token, DEX, lending, NFT, proxy, etc.)
 * 2. Suggest function names for unknown selectors with reasoning
 * 3. Provide a behavior summary
 */
export function buildBytecodeAnalysisPrompt(
  selectors: SelectorEntry[],
  proxyInfo: ProxyInfo,
  events: EventEntry[],
  sampleTxData?: string,
): AIMessage[] {
  // ---- System prompt ----
  const systemPrompt = `You are a world-class Solidity smart contract reverse engineer. You specialize in analyzing compiled bytecode, function selectors, event signatures, and transaction patterns to infer the purpose and behavior of Ethereum smart contracts.

Your capabilities include:
- Identifying contract types (ERC-20 token, ERC-721 NFT, DEX / AMM, lending protocol, staking, proxy, multisig wallet, governance, etc.)
- Mapping 4-byte function selectors to likely function names based on known signature databases and contextual clues
- Inferring contract behavior from proxy patterns, storage layouts, and event emissions
- Explaining reasoning behind every inference you make

When responding, you MUST use the following JSON structure (wrap it in a \`\`\`json code block):

\`\`\`json
{
  "contractType": "<inferred contract type>",
  "functions": [
    {
      "selector": "0xabcdef01",
      "inferredName": "suggestedFunctionName",
      "params": "parameter description (e.g., address, uint256)",
      "confidence": "HIGH | MEDIUM | LOW",
      "reasoning": "why you think this is the function name"
    }
  ],
  "summary": "A concise summary of the contract's behavior and purpose"
}
\`\`\`

Guidelines:
- For selectors that already have a known signature, still include them in the functions array with confidence "HIGH" and note the signature is known.
- For unknown selectors, analyze the context (other functions, events, proxy info) to make your best inference.
- Be thorough: every selector provided should appear in the functions array.
- Keep reasoning concise but informative (1-2 sentences).
- The summary should be 2-4 sentences covering the contract's purpose, notable patterns, and any risks.`;

  // ---- User prompt ----
  const sections: string[] = [];

  // Selectors
  sections.push('## Function Selectors');
  if (selectors.length === 0) {
    sections.push('No function selectors were extracted from the bytecode.');
  } else {
    const rows = selectors.map((s, i) => {
      const sig = s.signature ?? 'unknown';
      return `${i + 1}. Selector: \`${s.selector}\`  Signature: ${sig}`;
    });
    sections.push(rows.join('\n'));
  }

  // Proxy info
  sections.push('\n## Proxy Information');
  if (proxyInfo.isProxy) {
    let proxyLine = `This contract IS a proxy (type: ${proxyInfo.type ?? 'unknown'})`;
    if (proxyInfo.implementationAddress) {
      proxyLine += `\nImplementation address: \`${proxyInfo.implementationAddress}\``;
    }
    sections.push(proxyLine);
  } else {
    sections.push('This contract is NOT a proxy.');
  }

  // Events
  sections.push('\n## Event Signatures');
  if (events.length === 0) {
    sections.push('No events were detected.');
  } else {
    const eventLines = events.map((e, i) => {
      const topicList = e.topics
        .map((t, ti) => `  Topic${ti}: \`${t}\``)
        .join('\n');
      return `${i + 1}. ${topicList}`;
    });
    sections.push(eventLines.join('\n'));
  }

  // Sample transaction data
  if (sampleTxData) {
    sections.push('\n## Sample Transaction Calldata');
    sections.push(`\`\`\`\n${sampleTxData}\n\`\`\``);
  }

  const userPrompt = `Analyze the following smart contract data and provide your assessment.\n\n${sections.join('\n')}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
