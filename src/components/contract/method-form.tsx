"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Play,
  Eye,
  Send,
  AlertTriangle,
  Fuel,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { AbiMethod } from "@/lib/abi";
import { getPublicClient } from "@/lib/web3";
import { encodeCallData, formatResult } from "@/lib/abi";
import { useLocaleStore } from "@/stores/locale-store";
import { useChainStore } from "@/stores/chain-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useHistoryStore } from "@/stores/history-store";
import { useAiStore } from "@/stores/ai-store";
import { AIGateway, type AbiExplanation } from "@/lib/ai";
import { simulateTransaction, type SimulationResult } from "@/lib/web3/simulation";
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getAllChainConfigs } from "@/lib/web3";

interface MethodFormProps {
  method: AbiMethod;
  contractAddress: string;
  chainId: number;
  isRead: boolean;
}

export function MethodForm({
  method,
  contractAddress,
  chainId,
  isRead,
}: MethodFormProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const { t } = useLocaleStore();
  const { customRpcs, customChains } = useChainStore();
  const { address, connected, getPrivateKey } = useWalletStore();
  const { addTransaction, updateTransaction } = useHistoryStore();
  const [result, setResult] = useState<string | null>(null);
  const [calldata, setCalldata] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Write-specific state
  const [sendValue, setSendValue] = useState("0");
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [gasEstimateError, setGasEstimateError] = useState<string | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txState, setTxState] = useState<
    | null
    | "sending"
    | "confirming"
    | "confirmed"
    | "failed"
  >(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const isPayable = method.stateMutability === "payable";
  const aiStore = useAiStore();

  // AI explain state
  const [explanation, setExplanation] = useState<AbiExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);

  const handleExplain = useCallback(async () => {
    if (!aiStore.apiKey && aiStore.provider !== "ollama") {
      toast.error(t("contract.configureAiFirst"));
      return;
    }
    setExplaining(true);
    try {
      const gateway = new AIGateway();
      const result = await gateway.explainAbi(
        {
          provider: aiStore.provider,
          apiKey: aiStore.apiKey,
          baseUrl: aiStore.baseUrl,
          ollamaUrl: aiStore.ollamaUrl,
          modelId: aiStore.modelId,
        },
        method,
        result ?? undefined,
      );
      setExplanation(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI explain failed");
    } finally {
      setExplaining(false);
    }
  }, [aiStore, method, result, t]);

  // Error diagnosis state
  const [diagnosis, setDiagnosis] = useState<{ errorType: string; rootCause: string; suggestedFixes: string[]; confidence: string } | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const handleDiagnoseError = useCallback(async (errorMessage: string) => {
    if (!aiStore.apiKey && aiStore.provider !== "ollama") {
      toast.error(t("contract.configureAiFirst"));
      return;
    }
    setDiagnosing(true);
    try {
      const gateway = new AIGateway();
      const diag = await gateway.diagnoseError(
        {
          provider: aiStore.provider,
          apiKey: aiStore.apiKey,
          baseUrl: aiStore.baseUrl,
          ollamaUrl: aiStore.ollamaUrl,
          modelId: aiStore.modelId,
        },
        errorMessage,
        `Contract: ${contractAddress}, Method: ${method.name}, Chain: ${chainId}`,
      );
      setDiagnosis(diag);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Diagnosis failed");
    } finally {
      setDiagnosing(false);
    }
  }, [aiStore, contractAddress, method.name, chainId, t]);

  // Simulation state
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = useCallback(async () => {
    if (!calldata || !connected || !address) return;
    setSimulating(true);
    try {
      const value = parseEthToWei(sendValue);
      const result = await simulateTransaction(
        chainId,
        address,
        contractAddress,
        calldata,
        value > 0n ? value.toString() : undefined,
        getRpcUrl(),
        getChainMeta(),
      );
      setSimResult(result);
    } catch (err) {
      setSimResult({ success: false, error: err instanceof Error ? err.message : "Simulation failed" });
    } finally {
      setSimulating(false);
    }
  }, [calldata, connected, address, chainId, contractAddress, sendValue, customRpcs, customChains]);

  function handleInputChange(name: string, value: string) {
    setInputs((prev) => ({ ...prev, [name]: value }));
    setResult(null);
    setCalldata(null);
    setGasEstimate(null);
    setShowConfirm(false);
    setTxState(null);
    setTxHash(null);
  }

  function getRpcUrl(): string | undefined {
    return customRpcs[chainId] || customChains.find(c => c.id === chainId)?.rpcUrl;
  }

  function getChainMeta() {
    const customChain = customChains.find(c => c.id === chainId);
    return customChain
      ? {
          name: customChain.name,
          nativeCurrencySymbol: customChain.nativeCurrencySymbol,
          nativeCurrencyDecimals: customChain.nativeCurrencyDecimals,
        }
      : undefined;
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setResult(null);
      setCalldata(null);
      setGasEstimate(null);
      setShowConfirm(false);
      setTxState(null);
      setTxHash(null);

      try {
        const values: Record<string, unknown> = {};
        for (const key of Object.keys(inputs)) {
          values[key] = inputs[key];
        }

        const encoded = encodeCallData(method, values);

        if (isRead) {
          setIsLoading(true);
          try {
            const publicClient = getPublicClient(
              chainId,
              getRpcUrl(),
              getChainMeta(),
            );
            const rawResult = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: [
                {
                  type: "function",
                  name: method.name,
                  inputs: method.inputs.map((p) => ({
                    name: p.name,
                    type: p.type,
                    ...(p.components ? { components: p.components } : {}),
                  })),
                  outputs: method.outputs.map((p) => ({
                    name: p.name,
                    type: p.type,
                    ...(p.components ? { components: p.components } : {}),
                  })),
                  stateMutability: method.stateMutability as
                    | "pure"
                    | "view"
                    | "nonpayable"
                    | "payable",
                },
              ] as never,
              functionName: method.name,
              args:
                method.inputs.length > 0
                  ? method.inputs.map((input) => {
                      const raw = inputs[input.name];
                      if (raw === undefined || raw === "") return undefined;
                      return raw;
                    })
                  : undefined,
            });

            const formatted = formatResult(rawResult);
            setResult(formatted);
            toast.success(`${method.name}() call succeeded`);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Call failed";
            setResult(`Error: ${message}`);
            toast.error(`Call failed: ${message}`);
          } finally {
            setIsLoading(false);
          }
        } else {
          // Write: encode + prepare for confirmation
          setCalldata(encoded);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Encoding failed";
        toast.error(message);
      }
    },
    [inputs, method, contractAddress, chainId, isRead, customRpcs, customChains],
  );

  const handleEstimateGas = useCallback(async () => {
    if (!calldata) return;

    setEstimatingGas(true);
    setGasEstimateError(null);
    try {
      const publicClient = getPublicClient(
        chainId,
        getRpcUrl(),
        getChainMeta(),
      );

      const value = parseEthToWei(sendValue);

      const gas = await publicClient.estimateGas({
        to: contractAddress as `0x${string}`,
        data: calldata as `0x${string}`,
        account: address as `0x${string}`,
        ...(value > 0n ? { value } : {}),
      });

      setGasEstimate(gas);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gas estimation failed";
      setGasEstimateError(message);
      setGasEstimate(null);
    } finally {
      setEstimatingGas(false);
    }
  }, [calldata, chainId, address, sendValue, customRpcs, customChains]);

  const handleConfirmSend = useCallback(async () => {
    if (!calldata || !connected || !address) {
      toast.error(t("contract.noWallet"));
      return;
    }

    const pk = getPrivateKey();
    if (!pk) {
      toast.error(t("contract.noWallet"));
      return;
    }

    setTxState("sending");
    setShowConfirm(false);

    try {
      const rpcUrl = getRpcUrl();
      const publicClient = getPublicClient(chainId, rpcUrl, getChainMeta());
      const chain = publicClient.chain;

      const account = privateKeyToAccount(pk as `0x${string}`);

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl || undefined),
      });

      const value = parseEthToWei(sendValue);

      // Use estimated gas or a safe default (300k)
      const gas = gasEstimate ?? 300000n;

      // Send transaction
      const hash = await walletClient.sendTransaction({
        chain,
        to: contractAddress as `0x${string}`,
        data: calldata as `0x${string}`,
        gas,
        ...(value > 0n ? { value } : {}),
      });

      setTxHash(hash);
      setTxState("confirming");
      toast.success(t("contract.txSent"));

      // Record in history
      const txId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const allConfigs = getAllChainConfigs(customChains);
      const chainConfig = allConfigs[chainId];

      addTransaction({
        id: txId,
        hash,
        from: address,
        to: contractAddress,
        chainId,
        value: value.toString(),
        data: calldata,
        method: method.name,
        timestamp: Date.now(),
        status: "pending",
      });

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status === "success") {
        setTxState("confirmed");
        updateTransaction(txId, {
          status: "confirmed",
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          blockNumber: receipt.blockNumber.toString(),
        });
        toast.success(t("contract.txConfirmed"));
      } else {
        setTxState("failed");
        updateTransaction(txId, {
          status: "failed",
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          blockNumber: receipt.blockNumber.toString(),
        });
        toast.error(t("contract.txFailed"));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      setTxState("failed");
      toast.error(message);
    }
  }, [
    calldata,
    connected,
    address,
    getPrivateKey,
    chainId,
    contractAddress,
    method.name,
    sendValue,
    customRpcs,
    customChains,
    addTransaction,
    updateTransaction,
    t,
  ]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-sm">
          {isRead ? (
            <Eye className="h-4 w-4 text-emerald-400" />
          ) : (
            <Send className="h-4 w-4 text-amber-400" />
          )}
          {method.name}
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-400 text-[10px]"
          >
            {method.stateMutability}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExplain}
            disabled={explaining}
            className="ml-auto h-6 w-6 p-0 text-violet-400 hover:text-violet-300"
            title={t("contract.aiExplain")}
          >
            {explaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          {method.inputs.length > 0 && (
            <div className="space-y-2">
              {method.inputs.map((input) => (
                <div key={input.name} className="space-y-1">
                  <Label className="text-zinc-300 text-xs">
                    {input.name}{" "}
                    <span className="text-zinc-500">({input.type})</span>
                  </Label>
                  <Input
                    value={inputs[input.name] ?? ""}
                    onChange={(e) =>
                      handleInputChange(input.name, e.target.value)
                    }
                    placeholder={(() => {
                      const base = input.type.replace(/\[\d*\]/g, "");
                      if (base === "address") return "0x...";
                      if (base === "bool") return "true / false";
                      if (base === "string") return "Enter text...";
                      if (base.startsWith("bytes")) return "0x...";
                      if (base.startsWith("uint") || base.startsWith("int"))
                        return "0";
                      return "Enter value...";
                    })()}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-xs h-8"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Payable value input */}
          {isPayable && !isRead && (
            <div className="space-y-1">
              <Label className="text-zinc-300 text-xs flex items-center gap-1">
                {t("contract.sendValue")}
                <span className="text-zinc-500">
                  ({t("contract.sendValueHint")})
                </span>
              </Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={sendValue}
                onChange={(e) => {
                  setSendValue(e.target.value);
                  setGasEstimate(null);
                }}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-xs h-8"
              />
            </div>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={isLoading}
            className={
              isRead
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }
          >
            {isLoading ? (
              <span className="animate-pulse">{t("contract.calling")}</span>
            ) : isRead ? (
              <>
                <Play className="h-3 w-3 mr-1" /> {t("contract.call")}
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" /> {t("contract.encode")}
              </>
            )}
          </Button>
        </form>

        {/* Read result */}
        {result !== null && (
          <>
            <Separator className="bg-zinc-800" />
            <div className="space-y-1">
              <Label className="text-zinc-400 text-xs">
                {t("contract.result")}
              </Label>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
                {result}
              </pre>
              {result.startsWith("Error:") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDiagnoseError(result)}
                  disabled={diagnosing}
                  className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-7 text-xs"
                >
                  {diagnosing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  {t("contract.aiDiagnose")}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Write: calldata + send flow */}
        {calldata !== null && !isRead && (
          <>
            <Separator className="bg-zinc-800" />
            <div className="space-y-1">
              <Label className="text-zinc-400 text-xs font-mono">
                Calldata
              </Label>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs text-amber-400 font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                {calldata}
              </pre>
            </div>

            {/* Wallet not connected warning */}
            {!connected && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-red-300 text-xs">
                  {t("contract.noWallet")}
                </span>
              </div>
            )}

            {/* Gas estimation + Send flow */}
            {connected && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEstimateGas}
                    disabled={estimatingGas || txState === "sending" || txState === "confirming"}
                    className="border-zinc-700 text-zinc-300 h-8"
                  >
                    {estimatingGas ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Fuel className="h-3 w-3 mr-1" />
                    )}
                    {t("contract.estimateGas")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSimulate}
                    disabled={simulating || txState === "sending" || txState === "confirming"}
                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-8"
                  >
                    {simulating ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    {t("contract.simulate")}
                  </Button>
                  {gasEstimate !== null && (
                    <span className="text-emerald-400 text-xs font-mono">
                      {t("contract.gasEstimate")}: {gasEstimate.toString()}
                    </span>
                  )}
                  {gasEstimateError && (
                    <span className="text-amber-400 text-xs" title={gasEstimateError}>
                      Gas estimation failed (will use 300,000 default)
                    </span>
                  )}
                </div>

                {/* Confirm & Send button - always available when wallet is connected */}
                {!showConfirm && txState === null && (
                  <Button
                    size="sm"
                    onClick={() => setShowConfirm(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {t("contract.confirmSend")}
                  </Button>
                )}

                {/* Confirmation area */}
                {showConfirm && txState === null && (
                  <div className="bg-zinc-800/50 border border-amber-500/30 rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">
                        {t("contract.confirmSend")}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 space-y-1">
                      <p>
                        <span className="text-zinc-500">To:</span>{" "}
                        <span className="font-mono">{contractAddress}</span>
                      </p>
                      <p>
                        <span className="text-zinc-500">Method:</span>{" "}
                        <span className="font-mono">{method.name}()</span>
                      </p>
                      <p>
                        <span className="text-zinc-500">Gas Limit:</span>{" "}
                        <span className="font-mono">
                          {gasEstimate?.toString() ?? "300,000 (default)"}
                        </span>
                      </p>
                      {parseEthToWei(sendValue) > 0n && (
                        <p>
                          <span className="text-zinc-500">Value:</span>{" "}
                          <span className="font-mono">{sendValue} ETH</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleConfirmSend}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {t("contract.send")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConfirm(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simulation result */}
            {simResult && (
              <div className={`rounded-md p-3 space-y-1 border text-xs ${
                simResult.success
                  ? "bg-violet-500/10 border-violet-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center gap-2">
                  {simResult.success ? (
                    <CheckCircle className="h-4 w-4 text-violet-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className={simResult.success ? "text-violet-300" : "text-red-300"}>
                    {simResult.success ? t("contract.simulationSuccess") : t("contract.simulationFailed")}
                  </span>
                </div>
                {simResult.gasUsed && (
                  <div>
                    <span className="text-zinc-500">{t("contract.simulationGas")}:</span>{" "}
                    <span className="text-zinc-300 font-mono">{parseInt(simResult.gasUsed).toLocaleString()}</span>
                  </div>
                )}
                {simResult.returnValue && (
                  <div>
                    <span className="text-zinc-500">{t("contract.simulationReturnValue")}:</span>{" "}
                    <span className="text-zinc-300 font-mono break-all">{simResult.returnValue}</span>
                  </div>
                )}
                {simResult.error && (
                  <div>
                    <span className="text-zinc-500">{t("contract.simulationError")}:</span>{" "}
                    <span className="text-red-300 break-all">{simResult.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Transaction state display */}
            {txState !== null && (
              <div
                className={`rounded-md p-3 space-y-1 border ${
                  txState === "confirmed"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : txState === "failed"
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-amber-500/10 border-amber-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {txState === "sending" && (
                    <>
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      <span className="text-amber-300 text-xs font-medium">
                        {t("contract.sending")}
                      </span>
                    </>
                  )}
                  {txState === "confirming" && (
                    <>
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      <span className="text-amber-300 text-xs font-medium">
                        {t("contract.txSent")}
                      </span>
                    </>
                  )}
                  {txState === "confirmed" && (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-300 text-xs font-medium">
                        {t("contract.txConfirmed")}
                      </span>
                    </>
                  )}
                  {txState === "failed" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-red-300 text-xs font-medium">
                        {t("contract.txFailed")}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDiagnoseError("Transaction failed")}
                        disabled={diagnosing}
                        className="h-5 w-5 p-0 text-violet-400 hover:text-violet-300 ml-1"
                      >
                        {diagnosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      </Button>
                    </>
                  )}
                </div>
                {txHash && (
                  <p className="text-xs">
                    <span className="text-zinc-500">{t("contract.txHash")}:</span>{" "}
                    <span className="text-zinc-300 font-mono text-[11px] break-all">
                      {txHash}
                    </span>
                  </p>
                )}
              </div>
            )}
          </>
        )}
        {/* AI Explanation */}
        {explanation && (
          <>
            <Separator className="bg-zinc-800" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-violet-400 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                {t("contract.aiExplain")}
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-zinc-500">{t("contract.description")}:</span>{" "}
                  <span className="text-zinc-300">{explanation.description}</span>
                </div>
                <div>
                  <span className="text-zinc-500">{t("contract.methodType")}:</span>{" "}
                  <span className="text-zinc-300">{explanation.methodType}</span>
                </div>
                {explanation.inputs.length > 0 && (
                  <div>
                    <span className="text-zinc-500">{t("contract.inputs")}:</span>
                    <ul className="list-disc list-inside text-zinc-300 mt-1 space-y-0.5">
                      {explanation.inputs.map((inp, i) => (
                        <li key={i}><span className="text-emerald-400 font-mono">{inp.name}</span> ({inp.type}): {inp.explanation}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.outputs.length > 0 && (
                  <div>
                    <span className="text-zinc-500">{t("contract.outputs")}:</span>
                    <ul className="list-disc list-inside text-zinc-300 mt-1 space-y-0.5">
                      {explanation.outputs.map((out, i) => (
                        <li key={i}><span className="text-emerald-400 font-mono">{out.name}</span> ({out.type}): {out.explanation}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.usageExample && (
                  <div>
                    <span className="text-zinc-500">{t("contract.usageExample")}:</span>
                    <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 mt-1 text-emerald-400 font-mono text-[11px] whitespace-pre-wrap">{explanation.usageExample}</pre>
                  </div>
                )}
                {explanation.returnInterpretation && (
                  <div>
                    <span className="text-zinc-500">{t("contract.returnInterpretation")}:</span>{" "}
                    <span className="text-zinc-300">{explanation.returnInterpretation}</span>
                  </div>
                )}
                {explanation.commonPitfalls && (
                  <div>
                    <span className="text-zinc-500">{t("contract.commonPitfalls")}:</span>{" "}
                    <span className="text-zinc-300">{explanation.commonPitfalls}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* AI Error Diagnosis */}
        {diagnosis && (
          <>
            <Separator className="bg-zinc-800" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-violet-400 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                {t("contract.aiDiagnose")}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">{t("contract.errorType")}:</span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">{diagnosis.errorType}</Badge>
                </div>
                <div>
                  <span className="text-zinc-500">{t("contract.rootCause")}:</span>{" "}
                  <span className="text-zinc-300">{diagnosis.rootCause}</span>
                </div>
                {diagnosis.suggestedFixes.length > 0 && (
                  <div>
                    <span className="text-zinc-500">{t("contract.suggestedFixes")}:</span>
                    <ul className="list-disc list-inside text-zinc-300 mt-1 space-y-0.5">
                      {diagnosis.suggestedFixes.map((fix, i) => <li key={i}>{fix}</li>)}
                    </ul>
                  </div>
                )}
                <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-[10px]">
                  Confidence: {diagnosis.confidence}
                </Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function parseEthToWei(eth: string): bigint {
  const trimmed = eth.trim();
  if (!trimmed || trimmed === "0") return 0n;
  try {
    // Handle decimal ETH to wei
    const parts = trimmed.split(".");
    const whole = parts[0] || "0";
    const decimals = (parts[1] || "").padEnd(18, "0").slice(0, 18);
    return BigInt(whole) * 10n ** 18n + BigInt(decimals);
  } catch {
    return 0n;
  }
}
