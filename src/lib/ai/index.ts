// ---------------------------------------------------------------------------
// AI Gateway
// High-level interface combining providers, prompts, context assembly, and
// result parsing into a single unified API.
// ---------------------------------------------------------------------------

import { queryAI, type AIProviderConfig, type AIMessage, type AIResponse } from './providers';
import { buildBytecodeAnalysisPrompt } from './prompts/bytecode-analyzer';
import { buildAbiExplainPrompt } from './prompts/abi-explainer';
import { assembleBytecodeContext } from './context-assembler';
import {
  parseBytecodeAnalysis,
  verifySelectorSignature,
  type ParsedBytecodeAnalysis,
  type ParsedFunction,
} from './result-parser';

// ---- Re-exports for consumer convenience ----

export type {
  AIProviderConfig,
  AIMessage,
  AIResponse,
} from './providers';

export type {
  ParsedBytecodeAnalysis,
  ParsedFunction,
} from './result-parser';

export { verifySelectorSignature } from './result-parser';

// ---- Types used by gateway methods ----

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

interface AbiMethod {
  name: string;
  inputs: { name: string; type: string; components?: any[] }[];
  outputs: { name: string; type: string }[];
  stateMutability: string;
}

export interface AbiExplanation {
  description: string;
  methodType: string;
  inputs: { name: string; type: string; explanation: string; example: string }[];
  outputs: { name: string; type: string; explanation: string }[];
  usageExample: string;
  returnInterpretation: string;
  commonPitfalls: string;
}

export interface ErrorDiagnosis {
  errorType: string;
  rootCause: string;
  suggestedFixes: string[];
  relatedPatterns: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ParsedCallIntent {
  contractAddress?: string;
  methodName: string;
  params: { name: string; type: string; value: string }[];
  originalIntent: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ---------------------------------------------------------------------------
// Helper: extract JSON from AI response text
// ---------------------------------------------------------------------------

function extractJson<T>(raw: string): T | null {
  // Try ```json ... ``` block first
  const jsonFenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (jsonFenceMatch) {
    try {
      return JSON.parse(jsonFenceMatch[1].trim()) as T;
    } catch {
      // fall through
    }
  }

  // Try any ``` ... ``` block
  const fenceMatch = raw.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const content = fenceMatch[1].trim();
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        return JSON.parse(content) as T;
      } catch {
        // fall through
      }
    }
  }

  // Try first balanced { ... }
  const startIdx = raw.indexOf('{');
  if (startIdx !== -1) {
    let depth = 0;
    for (let i = startIdx; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      if (raw[i] === '}') depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(startIdx, i + 1)) as T;
        } catch {
          break;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// AIGateway class
// ---------------------------------------------------------------------------

export class AIGateway {
  /**
   * Analyze bytecode using AI.
   * Assembles on-chain context, builds the analysis prompt, queries the AI,
   * and parses the result into a structured analysis.
   */
  async analyzeBytecode(
    config: AIProviderConfig,
    bytecode: string,
    selectors: SelectorEntry[],
    proxyInfo: ProxyInfo,
    transactions?: Transaction[],
  ): Promise<ParsedBytecodeAnalysis> {
    // Build context for the AI
    const context = assembleBytecodeContext({
      bytecode,
      selectors,
      proxyInfo,
      recentTransactions: transactions,
    });

    // Extract events from transaction data
    const events: { topics: string[] }[] = [];
    // We could extract event topics from logs here if available

    // Extract sample tx data
    const sampleTxData = transactions?.[0]?.data;

    // Build the prompt
    const promptSelectors = selectors.map((s) => ({
      selector: s.selector,
      signature: s.signature,
    }));

    const messages = buildBytecodeAnalysisPrompt(
      promptSelectors,
      proxyInfo,
      events,
      sampleTxData,
    );

    // Inject context as additional user message if available
    if (context) {
      messages.push({
        role: 'user',
        content: `Additional on-chain context:\n\n${context}`,
      });
    }

    // Query the AI
    const response = await queryAI(config, messages);

    // Parse the result
    return parseBytecodeAnalysis(response.content);
  }

  /**
   * Explain an ABI method using AI.
   * Returns a field-by-field explanation, usage example, and return value
   * interpretation.
   */
  async explainAbi(
    config: AIProviderConfig,
    method: AbiMethod,
    sampleResult?: string,
  ): Promise<AbiExplanation> {
    const messages = buildAbiExplainPrompt(method, sampleResult);
    const response = await queryAI(config, messages);

    // Try to parse structured JSON from response
    const parsed = extractJson<AbiExplanation>(response.content);
    if (parsed && parsed.description) {
      return parsed;
    }

    // Fallback: wrap raw text in a minimal structure
    return {
      description: response.content.slice(0, 200),
      methodType: method.stateMutability,
      inputs: method.inputs.map((inp) => ({
        name: inp.name,
        type: inp.type,
        explanation: 'See AI response for details.',
        example: '',
      })),
      outputs: method.outputs.map((out) => ({
        name: out.name,
        type: out.type,
        explanation: 'See AI response for details.',
      })),
      usageExample: '',
      returnInterpretation: '',
      commonPitfalls: '',
    };
  }

  /**
   * Diagnose an error encountered during contract interaction.
   * Returns error type, root cause, suggested fixes, and confidence level.
   */
  async diagnoseError(
    config: AIProviderConfig,
    error: string | Error,
    context?: string,
  ): Promise<ErrorDiagnosis> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error && error.stack ? error.stack : '';

    const systemPrompt = `You are an expert in Ethereum smart contract development and debugging. You diagnose errors from contract interactions, transactions, and ABI encoding/decoding.

Respond with the following JSON structure (wrap in a \`\`\`json code block):

\`\`\`json
{
  "errorType": "Category of the error (e.g., revert, encoding, network, gas, permission)",
  "rootCause": "The underlying cause of the error",
  "suggestedFixes": ["Fix 1", "Fix 2", "Fix 3"],
  "relatedPatterns": ["Any related patterns or known issues"],
  "confidence": "HIGH | MEDIUM | LOW"
}
\`\`\`

Be specific and actionable. Include exact parameter values, function names, or addresses when relevant.`;

    const userParts: string[] = [
      `Error: ${errorMessage}`,
    ];
    if (errorStack) {
      userParts.push(`Stack trace:\n${errorStack}`);
    }
    if (context) {
      userParts.push(`Context:\n${context}`);
    }

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userParts.join('\n\n') },
    ];

    const response = await queryAI(config, messages);

    const parsed = extractJson<ErrorDiagnosis>(response.content);
    if (parsed && parsed.errorType) {
      return {
        errorType: parsed.errorType,
        rootCause: parsed.rootCause ?? '',
        suggestedFixes: Array.isArray(parsed.suggestedFixes) ? parsed.suggestedFixes : [],
        relatedPatterns: Array.isArray(parsed.relatedPatterns) ? parsed.relatedPatterns : [],
        confidence: parsed.confidence ?? 'MEDIUM',
      };
    }

    return {
      errorType: 'Unknown',
      rootCause: errorMessage,
      suggestedFixes: [],
      relatedPatterns: [],
      confidence: 'LOW',
    };
  }

  /**
   * Parse natural language input into a structured contract call intent.
   * Translates user-friendly descriptions into method names and parameters.
   */
  async parseNaturalLanguage(
    config: AIProviderConfig,
    input: string,
  ): Promise<ParsedCallIntent> {
    const systemPrompt = `You are an expert in Ethereum smart contracts. You translate natural language descriptions into structured contract call intents.

The user will describe a contract action in plain English. You must extract:
- The target contract address (if mentioned)
- The method name (using standard Solidity naming conventions)
- The parameters with their types and values

Respond with the following JSON structure (wrap in a \`\`\`json code block):

\`\`\`json
{
  "contractAddress": "0x... or null if not mentioned",
  "methodName": "suggestedFunctionName",
  "params": [
    { "name": "paramName", "type": "Solidity type", "value": "extracted or inferred value" }
  ],
  "originalIntent": "What the user wants to do in one sentence",
  "confidence": "HIGH | MEDIUM | LOW"
}
\`\`\`

Guidelines:
- Use standard ERC function names (transfer, approve, balanceOf, etc.) when applicable.
- Infer parameter types from context (e.g., amounts are usually uint256, addresses are address).
- If the user mentions a token amount, convert it to the raw uint256 value (wei).
- Set confidence HIGH if the intent is clear, MEDIUM if partially ambiguous, LOW if guessing.`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ];

    const response = await queryAI(config, messages);

    const parsed = extractJson<ParsedCallIntent>(response.content);
    if (parsed && parsed.methodName) {
      return {
        contractAddress: parsed.contractAddress ?? undefined,
        methodName: parsed.methodName,
        params: Array.isArray(parsed.params) ? parsed.params : [],
        originalIntent: parsed.originalIntent ?? input,
        confidence: parsed.confidence ?? 'MEDIUM',
      };
    }

    return {
      methodName: 'unknown',
      params: [],
      originalIntent: input,
      confidence: 'LOW',
    };
  }
}
