"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { History, Trash2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useHistoryStore, type Transaction } from "@/stores/history-store";
import { chainConfigMap, getAllChainConfigs } from "@/lib/web3";
import { getAddressLabel } from "@/lib/web3/address-labels";
import { useChainStore } from "@/stores/chain-store";
import { useLocaleStore } from "@/stores/locale-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return hash.slice(0, 10) + "..." + hash.slice(-6);
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + "..." + addr.slice(-4);
}

function formatTimestamp(ts: number, t: (key: string) => string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("history.justNow");
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function statusColor(status: Transaction["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "pending":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "failed":
      return "bg-red-500/15 text-red-400 border-red-500/30";
  }
}

function getExplorerUrl(allConfigs: Record<number, { blockExplorerUrl: string }>, chainId: number, txHash: string): string {
  const config = allConfigs[chainId];
  if (!config || !config.blockExplorerUrl) return "#";
  return `${config.blockExplorerUrl}/tx/${txHash}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const { transactions, clearHistory } = useHistoryStore();
  const { customChains } = useChainStore();
  const { t } = useLocaleStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const allChainConfigs = getAllChainConfigs(customChains);

  const handleClear = () => {
    if (!showConfirmClear) {
      setShowConfirmClear(true);
      return;
    }
    clearHistory();
    setShowConfirmClear(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="h-6 w-6" />
            {t("history.title")}
          </h1>
          <p className="text-zinc-400 text-sm">
            {t("history.description")}
          </p>
        </div>
        {transactions.length > 0 && (
          <div className="flex items-center gap-2">
            {showConfirmClear && (
              <span className="text-zinc-400 text-sm">{t("history.areYouSure")}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              onBlur={() => setShowConfirmClear(false)}
              className={`border-zinc-700 ${
                showConfirmClear
                  ? "text-red-400 border-red-500/50 hover:bg-red-500/10"
                  : "text-zinc-300"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {showConfirmClear ? t("history.confirmClear") : t("history.clearHistory")}
            </Button>
          </div>
        )}
      </div>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <History className="h-10 w-10 text-zinc-600" />
            <p className="text-zinc-400 text-sm font-medium">{t("history.noTransactions")}</p>
            <p className="text-zinc-500 text-xs">
              {t("history.noTransactionsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-3">
            {transactions.map((tx) => {
              const chainConfig = allChainConfigs[tx.chainId];
              return (
                <Card key={tx.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left side: tx info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Top row: hash + status */}
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm">
                            {truncateHash(tx.hash)}
                          </span>
                          <Badge
                            variant="outline"
                            className={statusColor(tx.status)}
                          >
                            {tx.status}
                          </Badge>
                          {chainConfig && (
                            <Badge
                              variant="outline"
                              className="text-zinc-300 border-zinc-600"
                            >
                              {chainConfig.name}
                            </Badge>
                          )}
                        </div>

                        {/* Middle row: from/to */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-400">{t("history.from")}</span>
                          <span className="text-zinc-300 font-mono">
                            {truncateAddress(tx.from)}
                          </span>
                          {getAddressLabel(tx.from, tx.chainId) && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[9px] h-4 px-1">
                              {getAddressLabel(tx.from, tx.chainId)}
                            </Badge>
                          )}
                          <span className="text-zinc-500">&rarr;</span>
                          <span className="text-zinc-400">{t("history.to")}</span>
                          <span className="text-zinc-300 font-mono">
                            {truncateAddress(tx.to)}
                          </span>
                          {getAddressLabel(tx.to, tx.chainId) && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[9px] h-4 px-1">
                              {getAddressLabel(tx.to, tx.chainId)}
                            </Badge>
                          )}
                        </div>

                        {/* Bottom row: method + timestamp */}
                        <div className="flex items-center gap-3 text-xs">
                          {tx.method && (
                            <span className="text-zinc-400">
                              {t("history.method")}{" "}
                              <span className="text-zinc-300 font-mono">
                                {tx.method}
                              </span>
                            </span>
                          )}
                          {tx.value && tx.value !== "0" && (
                            <span className="text-zinc-400">
                              {t("history.value")}{" "}
                              <span className="text-zinc-300">
                                {(Number(tx.value) / 1e18).toFixed(6)}{" "}
                                {chainConfig?.nativeCurrency.symbol || "ETH"}
                              </span>
                            </span>
                          )}
                          <span className="text-zinc-500">
                            {formatTimestamp(tx.timestamp, t)}
                          </span>
                        </div>
                      </div>

                      {/* Right side: details toggle + explorer link */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                          className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                        >
                          {expandedTx === tx.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                        <a
                          href={getExplorerUrl(allChainConfigs, tx.chainId, tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-white transition-colors p-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedTx === tx.id && (
                      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 space-y-1.5 text-xs">
                        {tx.blockNumber && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">{t("history.blockNumber")}</span>
                            <span className="text-zinc-300 font-mono">{tx.blockNumber}</span>
                          </div>
                        )}
                        {tx.gasUsed && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">{t("history.gasUsed")}</span>
                            <span className="text-zinc-300 font-mono">{parseInt(tx.gasUsed).toLocaleString()}</span>
                          </div>
                        )}
                        {tx.gasUsed && tx.effectiveGasPrice && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">{t("history.gasFee")}</span>
                            <span className="text-zinc-300 font-mono">
                              {(BigInt(tx.gasUsed) * BigInt(tx.effectiveGasPrice) / 10n ** 12n).toString()} Gwei
                            </span>
                          </div>
                        )}
                        {tx.nonce !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">{t("history.nonce")}</span>
                            <span className="text-zinc-300 font-mono">{tx.nonce}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
