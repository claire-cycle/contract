// ---------------------------------------------------------------------------
// ABI method explainer prompt builder
// Constructs prompts for AI-powered explanation of ABI method signatures
// ---------------------------------------------------------------------------

import type { AIMessage } from '../providers';

interface AbiParam {
  name: string;
  type: string;
  components?: AbiParam[];
}

interface AbiMethod {
  name: string;
  inputs: AbiParam[];
  outputs: { name: string; type: string }[];
  stateMutability: string;
}

/**
 * Build the message array for an ABI method explanation query.
 *
 * The AI is asked to provide:
 * 1. Field-by-field explanation of each input parameter
 * 2. Usage example (Solidity code snippet showing how to call the method)
 * 3. Return value interpretation
 */
export function buildAbiExplainPrompt(
  method: AbiMethod,
  sampleResult?: string,
): AIMessage[] {
  // ---- System prompt ----
  const systemPrompt = `You are an expert Solidity developer who specializes in explaining smart contract ABI methods clearly and thoroughly. You write for developers of all experience levels.

When explaining an ABI method, you MUST respond with the following JSON structure (wrap it in a \`\`\`json code block):

\`\`\`json
{
  "description": "A 1-2 sentence overview of what this method does",
  "methodType": "read (view/pure) | write (nonpayable) | payable",
  "inputs": [
    {
      "name": "paramName",
      "type": "Solidity type",
      "explanation": "What this parameter represents and how to format it",
      "example": "An example value"
    }
  ],
  "outputs": [
    {
      "name": "returnName",
      "type": "Solidity type",
      "explanation": "What this return value represents and how to interpret it"
    }
  ],
  "usageExample": "A short Solidity or ethers.js/viem code snippet showing how to call this method",
  "returnInterpretation": "How to interpret the return values, including any special encoding or decoding needed",
  "commonPitfalls": "Any common mistakes or things to watch out for when calling this method"
}
\`\`\`

Guidelines:
- Be precise about type encodings (e.g., uint256 vs uint8, bytes vs bytes32).
- For tuple/struct types, explain the component fields.
- For array types, explain expected array length and element format.
- Provide realistic example values.
- Note any gas implications for write methods.
- If the method has no inputs or outputs, use an empty array.`;

  // ---- Build method definition string ----
  const inputParams = method.inputs
    .map((inp) => {
      if (inp.type === 'tuple' && inp.components && inp.components.length > 0) {
        const inner = inp.components
          .map((c) => `${c.type} ${c.name}`)
          .join(', ');
        return `  ${inp.name}: tuple(${inner})`;
      }
      return `  ${inp.name}: ${inp.type}`;
    })
    .join('\n');

  const outputParams = method.outputs
    .map((out) => `  ${out.name}: ${out.type}`)
    .join('\n');

  const methodDef = `Function: ${method.name}
State Mutability: ${method.stateMutability}
Inputs:
${inputParams || '  (none)'}
Outputs:
${outputParams || '  (none)'}`;

  // ---- User prompt ----
  const sections: string[] = [];
  sections.push(`Explain the following Solidity ABI method:\n\n${methodDef}`);

  if (sampleResult) {
    sections.push(`\nA sample call returned this result:\n\`\`\`\n${sampleResult}\n\`\`\``);
    sections.push('Please incorporate the sample result into your return value interpretation.');
  }

  const userPrompt = sections.join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
