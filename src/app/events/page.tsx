"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Search, Loader2 } from "lucide-react";
import { getPublicClient, getAllChainConfigs } from "@/lib/web3";
import { parseAbiMethods, type AbiMethod } from "@/lib/abi/parser";
import { useChainStore } from "@/stores/chain-store";
import { useContractStore } from "@/stores/contract-store";
import { useLocaleStore } from "@/stores/locale-store";
import { toast } from "sonner";
import { type Log, parseAbiItem, decodeEventLog, type AbiEvent, formatUnits } from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecodedLog {
  blockNumber: bigint | null;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number | null;
  args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return hash.slice(0, 10) + "..." + hash.slice(-6);
}

function formatArgValue(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return "[" + value.map(formatArgValue).join(", ") + "]";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventsPage() {
  const { t } = useLocaleStore();
  const { customRpcs, customChains, selectedChainId } = useChainStore();
  const { abi: contractAbi, currentContract } = useContractStore();
  const allChainConfigs = useMemo(() => getAllChainConfigs(customChains), [customChains]);

  // Form state
  const [contractAddress, setContractAddress] = useState(
    currentContract?.address ?? ""
  );
  const [chainId, setChainId] = useState<number>(
    currentContract?.chainId ?? selectedChainId
  );
  const [abiInput, setAbiInput] = useState(
    contractAbi.length > 0 ? JSON.stringify(contractAbi) : ""
  );
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [fromBlock, setFromBlock] = useState("latest");
  const [toBlock, setToBlock] = useState("latest");

  // Result state
  const [isQuerying, setIsQuerying] = useState(false);
  const [logs, setLogs] = useState<DecodedLog[]>([]);

  // Parse ABI events
  const parsedMethods = useMemo<AbiMethod[]>(() => {
    if (!abiInput.trim()) return [];
    try {
      return parseAbiMethods(abiInput);
    } catch {
      return [];
    }
  }, [abiInput]);

  const eventDefinitions = useMemo(
    () => parsedMethods.filter((m) => m.type === "event"),
    [parsedMethods]
  );

  const selectedEvent = useMemo(
    () => eventDefinitions.find((e) => e.name === selectedEventName) ?? null,
    [eventDefinitions, selectedEventName]
  );

  // RPC helpers (matches pattern from analyzer page)
  function getRpcUrl(): string | undefined {
    return customRpcs[chainId] || customChains.find((c) => c.id === chainId)?.rpcUrl;
  }

  function getChainMeta() {
    const cc = customChains.find((c) => c.id === chainId);
    return cc
      ? {
          name: cc.name,
          nativeCurrencySymbol: cc.nativeCurrencySymbol,
          nativeCurrencyDecimals: cc.nativeCurrencyDecimals,
        }
      : undefined;
  }

  // Build a viem AbiEvent from our AbiMethod
  function buildViemEvent(eventDef: AbiMethod): AbiEvent {
    const inputs = eventDef.inputs.map((inp) => ({
      name: inp.name,
      type: inp.type as AbiEvent["inputs"][number]["type"],
      ...(inp.indexed !== undefined ? { indexed: inp.indexed } : {}),
      ...(inp.components
        ? { components: inp.components as AbiEvent["inputs"][number]["components"] }
        : {}),
    }));
    return {
      type: "event" as const,
      name: eventDef.name,
      inputs,
    } as AbiEvent;
  }

  // Query logs
  const handleQuery = useCallback(async () => {
    if (!contractAddress.trim()) {
      toast.error(t("toast.enterAddress"));
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress.trim())) {
      toast.error(t("toast.invalidAddress"));
      return;
    }
    if (!selectedEvent) {
      toast.error(t("events.selectEvent"));
      return;
    }

    setIsQuerying(true);
    setLogs([]);

    try {
      const publicClient = getPublicClient(chainId, getRpcUrl(), getChainMeta());
      const eventAbi = buildViemEvent(selectedEvent);

      const from = fromBlock.trim() === "latest" ? "latest" : BigInt(fromBlock.trim());
      const to = toBlock.trim() === "latest" ? "latest" : BigInt(toBlock.trim());

      const rawLogs = await publicClient.getLogs({
        address: contractAddress.trim() as `0x${string}`,
        event: eventAbi,
        fromBlock: from,
        toBlock: to,
      });

      const decoded: DecodedLog[] = rawLogs.map((log: Log) => {
        let args: Record<string, unknown> = {};
        try {
          const decodedLog = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics,
          });
          args = (decodedLog.args ?? {}) as Record<string, unknown>;
        } catch {
          // If decoding fails, try showing raw topics
          args = log.topics.reduce<Record<string, unknown>>((acc, topic, i) => {
            acc[`topic${i}`] = topic;
            return acc;
          }, {});
          if (log.data && log.data !== "0x") {
            args["data"] = log.data;
          }
        }

        return {
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex,
          logIndex: log.logIndex,
          args,
        };
      });

      setLogs(decoded);

      if (decoded.length === 0) {
        toast.info(t("events.noResults"));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsQuerying(false);
    }
  }, [contractAddress, chainId, selectedEvent, fromBlock, toBlock, customRpcs, customChains, t]);

  // Chain options for select: built-in + custom
  const chainOptions = useMemo(() => {
    const entries = Object.entries(allChainConfigs).map(([id, config]) => ({
      id: Number(id),
      name: config.name,
      color: config.color,
    }));
    return entries;
  }, [allChainConfigs]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="h-6 w-6" />
          {t("events.title")}
        </h1>
        <p className="text-zinc-400 text-sm">
          {t("events.description")}
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("events.title")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("events.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract Address + Chain Selector row */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">{t("events.contractAddress")}</Label>
              <Input
                placeholder="0x..."
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">
                {t("contract.chain")}
              </Label>
              <Select
                value={String(chainId)}
                onValueChange={(val) => setChainId(Number(val))}
              >
                <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {chainOptions.map((chain) => (
                    <SelectItem key={chain.id} value={String(chain.id)}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: chain.color }}
                        />
                        {chain.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ABI Input */}
          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="bg-zinc-800 border-zinc-700">
              <TabsTrigger value="paste" className="data-[state=active]:bg-zinc-700">
                {t("events.pasteAbi")}
              </TabsTrigger>
              <TabsTrigger value="loaded" className="data-[state=active]:bg-zinc-700">
                {t("contract.abiMethods")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-3">
              <Textarea
                placeholder='[{"name": "Transfer", "type": "event", "inputs": [...]}]'
                value={abiInput}
                onChange={(e) => {
                  setAbiInput(e.target.value);
                  setSelectedEventName("");
                }}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono text-xs min-h-[120px]"
              />
            </TabsContent>
            <TabsContent value="loaded" className="mt-3">
              {contractAbi.length > 0 ? (
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 text-xs text-zinc-300 font-mono max-h-[120px] overflow-auto">
                  {JSON.stringify(contractAbi, null, 2)}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  No ABI loaded from contract store.
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Event count badge */}
          {eventDefinitions.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                {eventDefinitions.length} event{eventDefinitions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Event selector + block range + query */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
            {/* Event selector */}
            <div className="space-y-2">
              <Label className="text-zinc-300">{t("events.selectEvent")}</Label>
              <Select
                value={selectedEventName}
                onValueChange={setSelectedEventName}
              >
                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder={t("events.selectEvent")} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {eventDefinitions.map((event) => (
                    <SelectItem key={event.name} value={event.name}>
                      {event.name}({event.inputs.map((i) => i.type).join(",")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From block */}
            <div className="space-y-2">
              <Label className="text-zinc-300">{t("events.fromBlock")}</Label>
              <Input
                placeholder="latest"
                value={fromBlock}
                onChange={(e) => setFromBlock(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono w-[140px]"
              />
            </div>

            {/* To block */}
            <div className="space-y-2">
              <Label className="text-zinc-300">{t("events.toBlock")}</Label>
              <Input
                placeholder="latest"
                value={toBlock}
                onChange={(e) => setToBlock(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono w-[140px]"
              />
            </div>

            {/* Query button */}
            <Button
              onClick={handleQuery}
              disabled={isQuerying || !selectedEventName}
              className="h-[34px]"
            >
              {isQuerying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t("events.querying")}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1.5" />
                  {t("events.query")}
                </>
              )}
            </Button>
          </div>

          {/* Selected event info */}
          {selectedEvent && (
            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                  Event
                </Badge>
                <span className="text-white text-sm font-medium">{selectedEvent.name}</span>
              </div>
              {selectedEvent.inputs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.inputs.map((inp, idx) => (
                    <span key={idx} className="text-zinc-400 text-xs">
                      <span className="text-zinc-300">{inp.name || `arg${idx}`}</span>
                      <span className="text-zinc-500">: {inp.type}</span>
                      {inp.indexed && (
                        <Badge variant="outline" className="ml-1 border-amber-500/30 text-amber-400 text-[9px] px-1 py-0">
                          indexed
                        </Badge>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {logs.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("events.results")}
              <Badge variant="outline" className="border-zinc-600 text-zinc-300 ml-2">
                {logs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-500px)] min-h-[200px]">
              <div className="space-y-3">
                {logs.map((log, idx) => {
                  const chainConfig = allChainConfigs[chainId];
                  const explorerUrl = chainConfig?.blockExplorerUrl
                    ? `${chainConfig.blockExplorerUrl}/tx/${log.transactionHash}`
                    : "#";

                  return (
                    <div
                      key={idx}
                      className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg overflow-hidden"
                    >
                      {/* Log header */}
                      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/60">
                        <Badge variant="outline" className="border-zinc-600 text-zinc-300 text-[10px] shrink-0">
                          {t("events.blockNumber")}
                        </Badge>
                        <span className="text-white text-xs font-mono">
                          {log.blockNumber?.toString() ?? "pending"}
                        </span>
                        <Separator orientation="vertical" className="h-4 bg-zinc-700" />
                        <Badge variant="outline" className="border-zinc-600 text-zinc-300 text-[10px] shrink-0">
                          {t("events.txHash")}
                        </Badge>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-mono transition-colors"
                        >
                          {truncateHash(log.transactionHash)}
                        </a>
                        <Separator orientation="vertical" className="h-4 bg-zinc-700" />
                        <span className="text-zinc-500 text-[10px]">
                          #{log.logIndex?.toString() ?? "-"}
                        </span>
                      </div>

                      {/* Decoded args */}
                      <div className="px-3 py-2">
                        <div className="space-y-1.5">
                          {Object.entries(log.args).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2 text-xs">
                              <span className="text-zinc-400 shrink-0 min-w-[80px] text-right">
                                {key}:
                              </span>
                              <span className="text-zinc-200 font-mono break-all">
                                {formatArgValue(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* No results placeholder */}
      {!isQuerying && logs.length === 0 && selectedEventName && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Bell className="h-8 w-8 text-zinc-600" />
            <p className="text-zinc-400 text-sm">{t("events.noResults")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
