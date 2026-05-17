import { z } from "zod";

// Zod schemas for ABI validation
const AbiParamSchema: z.ZodType<AbiParam> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),
    indexed: z.boolean().optional(),
    components: z.array(AbiParamSchema).optional(),
    internalType: z.string().optional(),
  })
);

const AbiMethodSchema = z.object({
  name: z.string(),
  type: z.enum(["function", "event", "constructor", "fallback", "receive", "error"]),
  inputs: z.array(AbiParamSchema),
  outputs: z.array(AbiParamSchema).optional(),
  stateMutability: z.enum(["pure", "view", "nonpayable", "payable"]).optional(),
  anonymous: z.boolean().optional(),
});

export interface AbiParam {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParam[];
  internalType?: string;
}

export interface AbiMethod {
  name: string;
  type: "function" | "event" | "constructor" | "fallback" | "receive" | "error";
  inputs: AbiParam[];
  outputs: AbiParam[];
  stateMutability: string;
}

/**
 * Parse ABI JSON string and return structured method definitions
 */
export function parseAbiMethods(abiJson: string): AbiMethod[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(abiJson);
  } catch {
    throw new Error("Invalid JSON format");
  }

  const abiArray = Array.isArray(parsed) ? parsed : parsed instanceof Object && "abi" in parsed ? (parsed as { abi: unknown }).abi : parsed;

  if (!Array.isArray(abiArray)) {
    throw new Error("ABI must be an array or an object with an 'abi' field");
  }

  const methods: AbiMethod[] = [];
  for (const item of abiArray) {
    const result = AbiMethodSchema.safeParse(item);
    if (result.success) {
      methods.push({
        name: result.data.name,
        type: result.data.type,
        inputs: result.data.inputs,
        outputs: result.data.outputs ?? [],
        stateMutability: result.data.stateMutability ?? "nonpayable",
      });
    }
  }

  return methods;
}

/**
 * Get function methods (read/write) from ABI
 */
export function getFunctionMethods(methods: AbiMethod[]) {
  const read = methods.filter(
    (m) => m.type === "function" && (m.stateMutability === "view" || m.stateMutability === "pure")
  );
  const write = methods.filter(
    (m) => m.type === "function" && m.stateMutability !== "view" && m.stateMutability !== "pure"
  );
  const events = methods.filter((m) => m.type === "event");
  return { read, write, events };
}

/**
 * Check if an ABI method has complex types (tuple, nested arrays, etc.)
 */
export function hasComplexTypes(method: AbiMethod): boolean {
  return method.inputs.some(hasComplexParam) || method.outputs.some(hasComplexParam);
}

function hasComplexParam(param: AbiParam): boolean {
  if (param.type.includes("tuple") || param.type.includes("[")) return true;
  if (param.components) return param.components.some(hasComplexParam);
  return false;
}

/**
 * Generate a form-friendly label for a Solidity type
 */
export function getTypeLabel(type: string): string {
  const baseType = type.replace(/\[\d*\]/g, "");
  const labels: Record<string, string> = {
    address: "Address (0x...)",
    uint256: "Uint256",
    uint: "Uint256",
    int256: "Int256",
    bool: "Boolean",
    string: "String",
    bytes: "Bytes",
    bytes32: "Bytes32",
    bytes4: "Bytes4",
    uint8: "Uint8",
    uint16: "Uint16",
    uint32: "Uint32",
    uint64: "Uint64",
    uint128: "Uint128",
    int8: "Int8",
    int128: "Int128",
    int: "Int256",
  };
  const base = labels[baseType] ?? baseType;
  if (type.includes("[]")) return `${base}[] (array)`;
  return base;
}

/**
 * Get placeholder text for a Solidity type
 */
export function getTypePlaceholder(type: string): string {
  const base = type.replace(/\[\d*\]/g, "");
  if (base === "address") return "0x0000...0000";
  if (base === "bool") return "true or false";
  if (base === "string") return "Enter text...";
  if (base.startsWith("bytes")) return "0x...";
  if (base.startsWith("uint") || base.startsWith("int")) return "0";
  if (base === "tuple") return "tuple (JSON)";
  return "Enter value...";
}

/**
 * Generate method signature string (e.g., "transfer(address,uint256)")
 */
export function getMethodSignature(method: AbiMethod): string {
  const params = method.inputs.map((i) => {
    if (i.type === "tuple" && i.components) {
      return `(${i.components.map((c) => c.type).join(",")})`;
    }
    return i.type;
  });
  return `${method.name}(${params.join(",")})`;
}
