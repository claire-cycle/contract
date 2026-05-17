"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  AlertTriangle,
  Bot,
  Sparkles,
  Copy,
  Check,
  Play,
  Send,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  History,
  RotateCcw,
} from "lucide-react";
import { getPublicClient, getAllChainConfigs } from "@/lib/web3";
import { BytecodeAnalyzer } from "@/lib/bytecode";
import { AIGateway } from "@/lib/ai";
import { selectorsToAbiJson } from "@/lib/abi/export";
import { saveFile } from "@/lib/tauri";
import { useChainStore } from "@/stores/chain-store";
import { useAiStore } from "@/stores/ai-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useHistoryStore } from "@/stores/history-store";
import { useAnalyzerStore, type AnalysisRecord } from "@/stores/analyzer-store";
import { useLocaleStore } from "@/stores/locale-store";
import { toast } from "sonner";
import { createWalletClient, http, formatUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedSelector {
  selector: string;
  signature?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source: string;
}

interface ProxyInfo {
  isProxy: boolean;
  type?: string;
  implementationAddress?: string;
}

interface AnalysisState {
  bytecode: string;
  selectors: DetectedSelector[];
  proxy: ProxyInfo;
  contractType?: string;
  bytecodeSize: number;
  isLoading: boolean;
}

interface AIAnalysisState {
  isLoading: boolean;
  result: string | null;
  error: string | null;
  /** Parsed function info from AI analysis, keyed by selector */
  functions: Record<string, AIFunctionInfo>;
  contractSummary?: string;
}

interface AIFunctionInfo {
  selector: string;
  name: string;
  params: string;
  confidence: string;
  reasoning: string;
  /** Inferred from name patterns: getters are read, setters/senders are write */
  isRead: boolean;
}

interface ParamInput {
  type: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(confidence: string) {
  switch (confidence.toUpperCase()) {
    case "HIGH":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "MEDIUM":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

function parseSignature(sig: string): { name: string; params: string[] } | null {
  const match = sig.match(/^(\w+)\((.*)\)$/);
  if (!match) return null;
  const name = match[1];
  const paramsStr = match[2].trim();
  const params = paramsStr ? paramsStr.split(",").map((p) => p.trim()) : [];
  return { name, params };
}

/** Parse AI analysis JSON into structured function info */
function parseAIResult(raw: string): { functions: Record<string, AIFunctionInfo>; summary?: string } {
  const functions: Record<string, AIFunctionInfo> = {};

  // Try to extract JSON
  let json: any = null;
  try {
    // Try ```json block
    const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
    if (fenceMatch) {
      json = JSON.parse(fenceMatch[1].trim());
    }
  } catch {}
  if (!json) {
    try {
      const startIdx = raw.indexOf("{");
      const endIdx = raw.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        json = JSON.parse(raw.slice(startIdx, endIdx + 1));
      }
    } catch {}
  }
  if (!json) return { functions };

  // Parse functions array
  const aiFunctions = Array.isArray(json.functions) ? json.functions : [];
  for (const fn of aiFunctions) {
    const selector = fn.selector?.trim();
    if (!selector) continue;
    const name = fn.inferredName || fn.name || "unknown";
    const isRead = /^(get|is|has|check|balance|total|name|symbol|decimals|owner|allowance)/i.test(name);
    functions[selector.startsWith("0x") ? selector : `0x${selector}`] = {
      selector: selector.startsWith("0x") ? selector : `0x${selector}`,
      name,
      params: fn.params || "none",
      confidence: fn.confidence || "LOW",
      reasoning: fn.reasoning || "",
      isRead,
    };
  }

  return { functions, summary: json.summary || undefined };
}

// ---------------------------------------------------------------------------
// AIFunctionCard — interactive card for an AI-analyzed function
// ---------------------------------------------------------------------------

function AIFunctionCard({
  fn,
  contractAddress,
  chainId,
}: {
  fn: AIFunctionInfo;
  contractAddress: string;
  chainId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRead = fn.isRead;

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-800/60"
        onClick={() => setExpanded(!expanded)}
      >
        <Badge
          variant="outline"
          className={`${isRead ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"} text-[10px] shrink-0`}
        >
          {isRead ? "Read" : "Write"}
        </Badge>
        <span className="text-white text-xs font-medium flex-1 min-w-0 truncate">
          {fn.name}
        </span>
        {fn.params && fn.params !== "none" && (
          <span className="text-zinc-400 text-[11px] font-mono truncate max-w-[200px]">
            ({fn.params})
          </span>
        )}
        <Badge variant="outline" className={`${confidenceColor(fn.confidence)} text-[10px] shrink-0`}>
          {fn.confidence}
        </Badge>
        <span className="text-zinc-500 font-mono text-[11px] shrink-0">{fn.selector}</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-zinc-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
        )}
      </div>

      {/* Expanded: reasoning + call panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-zinc-700/50">
          {fn.reasoning && (
            <p className="text-zinc-500 text-[11px] pt-2 italic">{fn.reasoning}</p>
          )}
          <SelectorCallPanel
            selector={fn.selector}
            aiInfo={fn}
            contractAddress={contractAddress}
            chainId={chainId}
            onClose={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectorCallPanel — inline panel for calling a selector
// ---------------------------------------------------------------------------

function SelectorCallPanel({
  selector,
  signature,
  aiInfo,
  contractAddress,
  chainId,
  onClose,
}: {
  selector: string;
  signature?: string;
  aiInfo?: AIFunctionInfo;
  contractAddress: string;
  chainId: number;
  onClose: () => void;
}) {
  const { t } = useLocaleStore();
  const { customRpcs, customChains } = useChainStore();
  const { connected, address, getPrivateKey } = useWalletStore();
  const { addTransaction, updateTransaction } = useHistoryStore();

  const parsed = signature ? parseSignature(signature) : null;

  // Build default params from signature, AI info, or fallback
  const buildDefaultParams = (): ParamInput[] => {
    // 1. If we have a parsed signature with real types, use it
    if (parsed && parsed.params.length > 0 && parsed.params[0] !== "") {
      return parsed.params.map((p) => ({ type: p, value: "" }));
    }
    // 2. If AI provided params, parse them
    if (aiInfo?.params && aiInfo.params !== "none") {
      const aiParams = aiInfo.params.split(",").map((p) => p.trim()).filter(Boolean);
      if (aiParams.length > 0) {
        return aiParams.map((p) => ({ type: p, value: "" }));
      }
    }
    // 3. Fallback: no params
    return [];
  };

  const [params, setParams] = useState<ParamInput[]>(buildDefaultParams);
  const [isRead, setIsRead] = useState(aiInfo?.isRead ?? true);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txState, setTxState] = useState<"sending" | "confirming" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  function getRpcUrl(): string | undefined {
    return customRpcs[chainId] || customChains.find((c) => c.id === chainId)?.rpcUrl;
  }
  function getChainMeta() {
    const cc = customChains.find((c) => c.id === chainId);
    return cc
      ? { name: cc.name, nativeCurrencySymbol: cc.nativeCurrencySymbol, nativeCurrencyDecimals: cc.nativeCurrencyDecimals }
      : undefined;
  }

  function updateParam(index: number, field: "type" | "value", val: string) {
    setParams((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: val } : p)));
    setResult(null);
  }

  function addParam() {
    setParams((prev) => [...prev, { type: "uint256", value: "" }]);
  }

  function removeParam(index: number) {
    setParams((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }

  function buildCalldata(): `0x${string}` | null {
    try {
      const types = params.map((p) => p.type.trim()).filter(Boolean);
      const values = params.map((p) => {
        const v = p.value.trim();
        if (!v) return undefined as unknown;
        // address
        if (p.type.trim() === "address" && !v.startsWith("0x")) return `0x${v}`;
        // bool
        if (p.type.trim() === "bool") return v.toLowerCase() === "true";
        // uint/int
        if (p.type.trim().startsWith("uint") || p.type.trim().startsWith("int")) {
          if (v.startsWith("0x")) return BigInt(v);
          return BigInt(v);
        }
        return v;
      });

      if (types.length === 0) {
        return selector as `0x${string}`;
      }

      const encoded = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: aiInfo?.name || parsed?.name || "unknown",
            inputs: types.map((type, i) => ({ name: `arg${i}`, type })),
            outputs: [],
            stateMutability: isRead ? "view" : "nonpayable",
          },
        ],
        functionName: aiInfo?.name || parsed?.name || "unknown",
        args: values,
      });
      return encoded;
    } catch (err) {
      return null;
    }
  }

  async function handleCall() {
    const calldata = buildCalldata();
    if (!calldata) {
      toast.error("Failed to encode calldata. Check parameter types and values.");
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const publicClient = getPublicClient(chainId, getRpcUrl(), getChainMeta());
      const data = await publicClient.call({
        to: contractAddress as `0x${string}`,
        data: calldata,
      });

      if (!data || !data.data || data.data === "0x") {
        setResult("(empty response or revert)");
      } else {
        try {
          // Try to decode as common types
          const hex = data.data as `0x${string}`;
          // Try raw bigint
          if (hex.length === 66) {
            const val = BigInt(hex);
            setResult(`${val.toString()}\n\n(hex: ${hex})`);
          } else {
            // Try to decode as bytes
            setResult(hex);
          }
        } catch {
          setResult(data.data ?? "(no data)");
        }
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Call failed"}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    if (!connected || !address) {
      toast.error(t("contract.noWallet"));
      return;
    }
    const pk = getPrivateKey();
    if (!pk) {
      toast.error(t("contract.noWallet"));
      return;
    }

    const calldata = buildCalldata();
    if (!calldata) {
      toast.error("Failed to encode calldata");
      return;
    }

    setTxState("sending");
    try {
      const rpcUrl = getRpcUrl();
      const publicClient = getPublicClient(chainId, rpcUrl, getChainMeta());
      const chain = publicClient.chain;
      const account = privateKeyToAccount(pk as `0x${string}`);
      const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl || undefined) });

      const hash = await walletClient.sendTransaction({
        account,
        chain,
        to: contractAddress as `0x${string}`,
        data: calldata,
        gas: 300000n,
      });

      setTxHash(hash);
      setTxState("confirming");
      toast.success(t("contract.txSent"));

      const txId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const allConfigs = getAllChainConfigs(customChains);

      addTransaction({
        id: txId,
        hash,
        from: address,
        to: contractAddress,
        chainId,
        value: "0",
        data: calldata,
        method: parsed?.name ?? selector,
        timestamp: Date.now(),
        status: "pending",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setTxState("confirmed");
        updateTransaction(txId, { status: "confirmed", gasUsed: receipt.gasUsed.toString() });
        toast.success(t("contract.txConfirmed"));
      } else {
        setTxState("failed");
        updateTransaction(txId, { status: "failed" });
        toast.error(t("contract.txFailed"));
      }
    } catch (err) {
      setTxState("failed");
      toast.error(err instanceof Error ? err.message : "Transaction failed");
    }
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-medium">
          {signature || selector} — {t("analyzer.call")}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Read/Write toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={isRead ? "default" : "outline"}
          className={isRead ? "bg-emerald-600 hover:bg-emerald-700" : "border-zinc-700 text-zinc-300"}
          onClick={() => { setIsRead(true); setTxState(null); setTxHash(null); }}
        >
          <Play className="h-3 w-3 mr-1" /> Read
        </Button>
        <Button
          size="sm"
          variant={!isRead ? "default" : "outline"}
          className={!isRead ? "bg-amber-600 hover:bg-amber-700" : "border-zinc-700 text-zinc-300"}
          onClick={() => { setIsRead(false); setTxState(null); setTxHash(null); }}
        >
          <Send className="h-3 w-3 mr-1" /> Write
        </Button>
      </div>

      {/* Parameters */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs">{t("analyzer.params")}</Label>
        {params.map((param, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <Input
              placeholder={t("analyzer.paramType")}
              value={param.type}
              onChange={(e) => updateParam(idx, "type", e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 w-28 font-mono"
            />
            <Input
              placeholder={t("analyzer.paramValue")}
              value={param.value}
              onChange={(e) => updateParam(idx, "value", e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 flex-1 font-mono"
            />
            {params.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeParam(idx)}>
                <Trash2 className="h-3 w-3 text-zinc-500" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addParam} className="border-dashed border-zinc-700 text-zinc-400 h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> {t("analyzer.addParam")}
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {isRead ? (
          <Button size="sm" onClick={handleCall} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
            {t("analyzer.call")}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSend}
            disabled={txState === "sending" || txState === "confirming"}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {txState === "sending" || txState === "confirming" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Send className="h-3 w-3 mr-1" />
            )}
            {t("analyzer.send")}
          </Button>
        )}
      </div>

      {/* Tx state */}
      {txState && (
        <div
          className={`rounded-md p-2 text-xs ${
            txState === "confirmed"
              ? "bg-emerald-500/10 text-emerald-300"
              : txState === "failed"
                ? "bg-red-500/10 text-red-300"
                : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {txState === "sending" && t("contract.sending")}
          {txState === "confirming" && t("contract.txSent")}
          {txState === "confirmed" && t("contract.txConfirmed")}
          {txState === "failed" && t("contract.txFailed")}
          {txHash && (
            <p className="font-mono text-[11px] mt-1 opacity-70 break-all">{txHash}</p>
          )}
        </div>
      )}

      {/* Result */}
      {result !== null && (
        <div className="space-y-1">
          <Label className="text-zinc-400 text-xs">{t("analyzer.callResult")}</Label>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyzerPage() {
  const [address, setAddress] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisState>({ isLoading: false, result: null, error: null, functions: {}, contractSummary: undefined });
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);
  const [expandedSelector, setExpandedSelector] = useState<number | null>(null);

  const { selectedChainId, customRpcs, customChains } = useChainStore();
  const { provider, apiKey, baseUrl, ollamaUrl, modelId } = useAiStore();
  const { t } = useLocaleStore();
  const { records, activeId, addRecord, removeRecord, setActive, updateAiResult } = useAnalyzerStore();
  const allChainConfigs = getAllChainConfigs(customChains);

  // Restore active analysis on mount
  useState(() => {
    if (activeId) {
      const record = records.find((r) => r.id === activeId);
      if (record) {
        setAddress(record.address);
        setAnalysis({
          bytecode: record.bytecode,
          selectors: record.selectors.map((s) => ({
            selector: s.selector,
            signature: s.signature,
            confidence: s.confidence as "HIGH" | "MEDIUM" | "LOW",
            source: s.source,
          })),
          proxy: {
            isProxy: record.proxy.isProxy,
            type: record.proxy.type,
            implementationAddress: record.proxy.implementationAddress,
          },
          contractType: record.contractType,
          bytecodeSize: record.bytecodeSize,
          isLoading: false,
        });
        if (record.aiResult) {
          const parsed = parseAIResult(record.aiResult);
          setAiAnalysis({ isLoading: false, result: record.aiResult, error: null, functions: parsed.functions, contractSummary: parsed.summary });
        }
      }
    }
  });

  const handleAnalyze = useCallback(async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      toast.error(t("toast.enterAddress"));
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      toast.error(t("toast.invalidAddress"));
      return;
    }

    setAnalysis(null);
    setError(null);
    setAiAnalysis({ isLoading: false, result: null, error: null, functions: {} });
    setExpandedSelector(null);

    try {
      setAnalysis({
        bytecode: "",
        selectors: [],
        proxy: { isProxy: false },
        bytecodeSize: 0,
        isLoading: true,
      });

      const analyzer = new BytecodeAnalyzer();
      const customChain = customChains.find((c) => c.id === selectedChainId);
      const result = await analyzer.analyse(
        trimmed,
        selectedChainId,
        customRpcs[selectedChainId] || customChain?.rpcUrl,
        customChain
          ? {
              name: customChain.name,
              nativeCurrencySymbol: customChain.nativeCurrencySymbol,
              nativeCurrencyDecimals: customChain.nativeCurrencyDecimals,
            }
          : undefined,
      );

      const analysisResult = {
        bytecode: result.bytecode,
        selectors: result.selectors.map((s) => ({
          selector: s.selector,
          signature: s.signature,
          confidence: s.confidence as "HIGH" | "MEDIUM" | "LOW",
          source: s.source,
        })),
        proxy: {
          isProxy: result.proxyInfo.isProxy,
          type: result.proxyInfo.type,
          implementationAddress: result.proxyInfo.implementationAddress,
        },
        contractType: result.contractType,
        bytecodeSize: (result.bytecode.length - 2) / 2,
        isLoading: false,
      };

      setAnalysis(analysisResult);

      // Persist to store
      addRecord({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: trimmed,
        chainId: selectedChainId,
        bytecode: result.bytecode,
        bytecodeSize: analysisResult.bytecodeSize,
        selectors: result.selectors.map((s) => ({
          selector: s.selector,
          signature: s.signature,
          confidence: s.confidence,
          source: s.source,
        })),
        proxy: {
          isProxy: result.proxyInfo.isProxy,
          type: result.proxyInfo.type,
          implementationAddress: result.proxyInfo.implementationAddress,
        },
        contractType: result.contractType,
        timestamp: Date.now(),
      });

      toast.success(`${t("toast.analysisComplete")}: ${result.selectors.length}`);
    } catch (e) {
      setError((e as Error).message || t("toast.analysisFailed"));
      setAnalysis(null);
    }
  }, [address, selectedChainId, customRpcs, customChains, t]);

  const handleAIAnalysis = useCallback(async () => {
    if (!analysis || !apiKey) return;

    setAiAnalysis({ isLoading: true, result: null, error: null, functions: aiAnalysis.functions, contractSummary: aiAnalysis.contractSummary });

    try {
      const gateway = new AIGateway();
      const result = await gateway.analyzeBytecode(
        { provider, apiKey, baseUrl, ollamaUrl, modelId },
        analysis.bytecode,
        analysis.selectors,
        analysis.proxy,
      );

      const formatted = typeof result === "string" ? result : JSON.stringify(result, null, 2);

      // Parse structured function info from AI result
      const parsed = parseAIResult(formatted);

      setAiAnalysis({ isLoading: false, result: formatted, error: null, functions: parsed.functions, contractSummary: parsed.summary });

      // Persist AI result
      if (activeId) updateAiResult(activeId, formatted);

      toast.success(t("toast.aiAnalysisComplete"));
    } catch (e) {
      const message = (e as Error).message || "AI analysis failed";
      setAiAnalysis({ isLoading: false, result: null, error: message, functions: {} });
      toast.error(message);
    }
  }, [analysis, apiKey, provider, baseUrl, ollamaUrl, modelId, t]);

  function copyToClipboard(text: string, selector: string) {
    navigator.clipboard.writeText(text);
    setCopiedSelector(selector);
    setTimeout(() => setCopiedSelector(null), 2000);
  }

  function restoreRecord(record: AnalysisRecord) {
    setActive(record.id);
    setAddress(record.address);
    setError(null);
    setExpandedSelector(null);
    setAnalysis({
      bytecode: record.bytecode,
      selectors: record.selectors.map((s) => ({
        selector: s.selector,
        signature: s.signature,
        confidence: s.confidence as "HIGH" | "MEDIUM" | "LOW",
        source: s.source,
      })),
      proxy: {
        isProxy: record.proxy.isProxy,
        type: record.proxy.type,
        implementationAddress: record.proxy.implementationAddress,
      },
      contractType: record.contractType,
      bytecodeSize: record.bytecodeSize,
      isLoading: false,
    });
    setAiAnalysis(
      record.aiResult
        ? { isLoading: false, result: record.aiResult, error: null, functions: parseAIResult(record.aiResult).functions, contractSummary: parseAIResult(record.aiResult).summary }
        : { isLoading: false, result: null, error: null, functions: {}, contractSummary: undefined },
    );
    toast.success(t("toast.analysisComplete"));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Search className="h-6 w-6" />
          {t("analyzer.title")}
        </h1>
        <p className="text-zinc-400 text-sm">{t("analyzer.description")}</p>
      </div>

      {/* Input */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("analyzer.contractAddress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAnalyze();
                }}
              />
            </div>
            <Button onClick={handleAnalyze} disabled={analysis?.isLoading}>
              {analysis?.isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                  {t("analyzer.analyzing")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {t("analyzer.analyze")}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis History */}
      {records.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("analyzer.history")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {records.map((rec) => {
                const chainConf = allChainConfigs[rec.chainId];
                const isActive = rec.id === activeId;
                return (
                  <div
                    key={rec.id}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                      isActive ? "bg-zinc-800 border border-zinc-700" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono truncate">{rec.address}</span>
                        {chainConf && (
                          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 shrink-0">
                            {chainConf.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500 mt-0.5">
                        <span>{rec.selectors.length} selectors</span>
                        <span>{new Date(rec.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-zinc-400 hover:text-white shrink-0"
                      onClick={() => restoreRecord(rec)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t("analyzer.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-500 hover:text-red-400 shrink-0"
                      onClick={() => removeRecord(rec.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-zinc-900 border-red-900/50">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium text-sm">{t("analyzer.analysisError")}</p>
              <p className="text-zinc-400 text-sm mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysis && !analysis.isLoading && (
        <Tabs defaultValue="selectors">
          <TabsList className="bg-zinc-800 border-zinc-700">
            <TabsTrigger value="selectors" className="data-[state=active]:bg-zinc-700">
              {t("analyzer.selectors")} ({analysis.selectors.length})
            </TabsTrigger>
            <TabsTrigger value="proxy" className="data-[state=active]:bg-zinc-700">
              {t("analyzer.proxyDetection")}
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-zinc-700">
              <Bot className="h-3 w-3 mr-1" />
              {t("analyzer.aiAnalysis")}
            </TabsTrigger>
          </TabsList>

          {/* Selectors Tab */}
          <TabsContent value="selectors" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center justify-between">
                  {t("analyzer.detectedSelectors")}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const json = selectorsToAbiJson(analysis.selectors.map(s => ({
                          selector: s.selector,
                          signature: s.signature,
                          confidence: s.confidence === "HIGH" ? 1 : s.confidence === "MEDIUM" ? 0.7 : 0.3,
                          source: s.source,
                        })));
                        navigator.clipboard.writeText(json);
                        toast.success(t("toast.abiExported"));
                      }}
                      className="border-zinc-700 text-zinc-300 h-7"
                    >
                      {t("analyzer.exportAbi")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const json = selectorsToAbiJson(analysis.selectors.map(s => ({
                          selector: s.selector,
                          signature: s.signature,
                          confidence: s.confidence === "HIGH" ? 1 : s.confidence === "MEDIUM" ? 0.7 : 0.3,
                          source: s.source,
                        })));
                        await saveFile(json, `abi-${analysis.selectors[0]?.selector || "export"}.json`);
                        toast.success(t("toast.fileExported"));
                      }}
                      className="border-zinc-700 text-zinc-300 h-7"
                    >
                      {t("common.exportFile")}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">
                  {t("analyzer.bytecodeSize")}: {analysis.bytecodeSize.toLocaleString()} {t("common.bytes")}
                  {analysis.contractType && ` | ${t("analyzer.contractType")}: ${analysis.contractType}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.selectors.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">{t("analyzer.noSelectors")}</p>
                ) : (
                  <div className="space-y-0">
                    {analysis.selectors.map((sel, idx) => {
                      const aiFn = aiAnalysis.functions[sel.selector];
                      // Use AI name when no 4byte signature
                      const displayName = sel.signature
                        ? sel.signature
                        : aiFn
                          ? `${aiFn.name}(${aiFn.params === "none" ? "" : aiFn.params})`
                          : null;
                      // Merge confidence: 4byte HIGH > AI HIGH > ...
                      const mergedConfidence = sel.confidence === "HIGH" && sel.source !== "ai"
                        ? "HIGH"
                        : aiFn?.confidence === "HIGH"
                          ? "HIGH"
                          : sel.confidence;

                      return (
                        <div key={idx} className="border-b border-zinc-800/50 last:border-b-0">
                          {/* Row */}
                          <div className="flex items-center gap-2 py-2.5 px-2 hover:bg-zinc-800/20">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setExpandedSelector(expandedSelector === idx ? null : idx)}
                            >
                              {expandedSelector === idx ? (
                                <ChevronUp className="h-3 w-3 text-zinc-400" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-zinc-400" />
                              )}
                            </Button>
                            <span className="font-mono text-xs text-zinc-300 w-[74px] shrink-0">{sel.selector}</span>
                            <span className="text-zinc-300 font-mono text-xs flex-1 min-w-0 truncate">
                              {displayName || <span className="text-zinc-500 italic">{t("analyzer.unknown")}</span>}
                            </span>
                            <Badge variant="outline" className={`${confidenceColor(mergedConfidence)} text-[10px] shrink-0`}>
                              {mergedConfidence}
                            </Badge>
                            <span className="text-zinc-400 text-xs w-16 shrink-0 hidden sm:block">{sel.source}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => copyToClipboard(sel.selector, sel.selector)}
                            >
                              {copiedSelector === sel.selector ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3 text-zinc-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-zinc-400 hover:text-white shrink-0"
                              onClick={() => setExpandedSelector(expandedSelector === idx ? null : idx)}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {t("analyzer.call")}
                            </Button>
                          </div>

                          {/* Expanded call panel */}
                          {expandedSelector === idx && (
                            <div className="px-2 pb-3">
                              <SelectorCallPanel
                                selector={sel.selector}
                                signature={sel.signature}
                                aiInfo={aiFn}
                                contractAddress={address.trim()}
                                chainId={selectedChainId}
                                onClose={() => setExpandedSelector(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proxy Tab */}
          <TabsContent value="proxy" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("analyzer.proxyDetection")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.proxy.isProxy ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                        {t("analyzer.proxyDetected")}
                      </Badge>
                      {analysis.proxy.type && (
                        <Badge variant="outline" className="text-zinc-300 border-zinc-600">
                          {analysis.proxy.type}
                        </Badge>
                      )}
                    </div>
                    {analysis.proxy.implementationAddress && (
                      <div className="space-y-1">
                        <Label className="text-zinc-400 text-xs">{t("analyzer.implementationAddress")}</Label>
                        <p className="text-white font-mono text-sm bg-zinc-800 rounded-lg px-3 py-2 break-all">
                          {analysis.proxy.implementationAddress}
                        </p>
                      </div>
                    )}
                    {!analysis.proxy.implementationAddress && (
                      <p className="text-zinc-400 text-sm">{t("analyzer.proxyExtractFail")}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      {t("analyzer.noProxy")}
                    </Badge>
                    <p className="text-zinc-400 text-sm">{t("analyzer.noProxyDesc")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ai" className="mt-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {t("analyzer.aiAnalysis")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!apiKey ? (
                  <div className="text-center py-12 space-y-3">
                    <Bot className="h-10 w-10 text-zinc-600 mx-auto" />
                    <p className="text-zinc-400 text-sm">{t("analyzer.configureAi")}</p>
                    <p className="text-zinc-500 text-xs">{t("analyzer.configureAiDesc")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      onClick={handleAIAnalysis}
                      disabled={aiAnalysis.isLoading}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {aiAnalysis.isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {t("analyzer.analyzing")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t("analyzer.runAiAnalysis")}
                        </span>
                      )}
                    </Button>

                    {aiAnalysis.error && (
                      <Card className="bg-zinc-900 border-red-900/50">
                        <CardContent className="pt-4">
                          <p className="text-red-400 text-sm">{aiAnalysis.error}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Contract Summary */}
                    {aiAnalysis.contractSummary && (
                      <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
                        <Label className="text-violet-300 text-xs font-medium mb-1 block">Contract Summary</Label>
                        <p className="text-zinc-300 text-xs leading-relaxed">{aiAnalysis.contractSummary}</p>
                      </div>
                    )}

                    {/* Interactive function cards */}
                    {Object.keys(aiAnalysis.functions).length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-zinc-400 text-xs">Functions ({Object.keys(aiAnalysis.functions).length})</Label>
                        {Object.values(aiAnalysis.functions).map((fn) => (
                          <AIFunctionCard
                            key={fn.selector}
                            fn={fn}
                            contractAddress={address.trim()}
                            chainId={selectedChainId}
                          />
                        ))}
                      </div>
                    )}

                    {/* Raw result toggle */}
                    {aiAnalysis.result && (
                      <details className="group">
                        <summary className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-400">
                          Show raw AI response
                        </summary>
                        <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-4 text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto mt-2">
                          {aiAnalysis.result}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
