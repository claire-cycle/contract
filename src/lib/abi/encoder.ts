import { encodeFunctionData, decodeFunctionResult, type Abi } from "viem";
import type { AbiMethod, AbiParam } from "./parser";

/**
 * Encode function call data from method definition and input values
 */
export function encodeCallData(method: AbiMethod, values: Record<string, unknown>): `0x${string}` {
  const abiItem = methodToAbiItem(method);
  return encodeFunctionData({
    abi: [abiItem],
    functionName: method.name,
    args: method.inputs.map((input) => parseInputValue(input, values[input.name])),
  });
}

/**
 * Decode function result from hex data
 */
export function decodeResult(method: AbiMethod, data: `0x${string}`): unknown[] {
  const abiItem = methodToAbiItem(method);
  try {
    const result = decodeFunctionResult({
      abi: [abiItem],
      functionName: method.name,
      data,
    });
    if (Array.isArray(result)) return result;
    return [result];
  } catch {
    return [data];
  }
}

/**
 * Format decoded result for display
 */
export function formatResult(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => formatResult(v, depth + 1));
    return depth < 2 ? `[\n  ${items.join(",\n  ")}\n]` : `[${items.join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const pairs = entries.map(([k, v]) => `${k}: ${formatResult(v, depth + 1)}`);
    return depth < 2 ? `{\n  ${pairs.join(",\n  ")}\n}` : `{${pairs.join(", ")}}`;
  }
  return String(value);
}

/**
 * Convert AbiMethod to viem-compatible ABI fragment
 */
function methodToAbiItem(method: AbiMethod): Abi[number] {
  return {
    type: "function",
    name: method.name,
    inputs: method.inputs.map(paramToAbiParam),
    outputs: method.outputs.map(paramToAbiParam),
    stateMutability: method.stateMutability as "pure" | "view" | "nonpayable" | "payable",
  } as Abi[number];
}

function paramToAbiParam(param: AbiParam): Abi[number] extends { inputs: infer I } ? I extends (infer T)[] ? T : never : never {
  const result: Record<string, unknown> = {
    name: param.name,
    type: param.type,
  };
  if (param.components) {
    result.components = param.components.map(paramToAbiParam);
  }
  if (param.indexed !== undefined) {
    result.indexed = param.indexed;
  }
  return result as Abi[number] extends { inputs: infer I } ? I extends (infer T)[] ? T : never : never;
}

/**
 * Parse a user input string into the appropriate type for encoding
 */
function parseInputValue(param: AbiParam, value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const str = String(value).trim();
  const baseType = param.type.replace(/\[\d*\]/g, "").replace(/\[\]/g, "");

  // Handle arrays
  if (param.type.endsWith("[]")) {
    try {
      const arr = JSON.parse(str);
      if (!Array.isArray(arr)) return [parsePrimitive(baseType, str)];
      return arr.map((item: unknown) => parsePrimitive(baseType, String(item)));
    } catch {
      // Try comma-separated
      return str.split(",").map((s) => parsePrimitive(baseType, s.trim()));
    }
  }

  // Handle tuple
  if (baseType === "tuple" && param.components) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === "object" && parsed !== null) {
        return param.components.map((comp) => {
          const val = (parsed as Record<string, unknown>)[comp.name];
          return parseInputValue(comp, val);
        });
      }
    } catch {
      // Return as-is and let viem handle it
    }
  }

  return parsePrimitive(baseType, str);
}

function parsePrimitive(type: string, value: string): unknown {
  if (type === "bool") {
    return value.toLowerCase() === "true";
  }
  if (type.startsWith("uint") || type.startsWith("int")) {
    if (value.startsWith("0x")) return BigInt(value);
    const num = Number(value);
    if (!isNaN(num) && Number.isSafeInteger(num)) return BigInt(num);
    return BigInt(value);
  }
  if (type === "address") {
    return value;
  }
  if (type.startsWith("bytes")) {
    return value;
  }
  return value;
}
