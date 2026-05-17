"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, Loader2, Copy, Check } from "lucide-react";
import { getPublicClient, getAllChainConfigs, supportedChains } from "@/lib/web3";
import { useChainStore } from "@/stores/chain-store";
import { useLocaleStore } from "@/stores/locale-store";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Common proxy storage slots
// ---------------------------------------------------------------------------

const COMMON_SLOTS = [
  { label: "Slot 0", slot: "0x0" },
  { label: "Slot 1", slot: "0x1" },
  { label: "Owner (0x0)", slot: "0x0" },
  {
    label: "Implementation",
    slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  },
  { label: "Beacon", slot: "0x1" },
] as const;

// ---------------------------------------------------------------------------
// Interpretation helpers
// ---------------------------------------------------------------------------

interface Interpretation {
  type: string;
  value: string;
  label: string;
}

function interpretStorageValue(hex: string): Interpretation[] {
  if (!hex) return [];

  const results: Interpretation[] = [];

  // Raw bytes32
  results.push({
    type: "bytes32",
    value: hex,
    label: "storage.rawHex",
  });

  // uint256
  try {
    const bigIntValue = BigInt(hex);
    results.push({
      type: "uint256",
      value: bigIntValue.toString(),
      label: "storage.asUint256",
    });
  } catch {
    // ignore
  }

  // bool (exactly 0 or 1)
  try {
    const bigIntValue = BigInt(hex);
    if (bigIntValue === 0n || bigIntValue === 1n) {
      results.push({
        type: "bool",
        value: bigIntValue === 1n ? "true" : "false",
        label: "storage.asBool",
      });
    }
  } catch {
    // ignore
  }

  // address — last 20 bytes (right-padded in a 32-byte slot)
  try {
    if (hex.length === 66) {
      // 0x + 64 hex chars
      const addressPart = "0x" + hex.slice(26); // last 40 hex chars
      // Check it is a plausible address (not all zeros, not all f's)
      if (/^0x[0-9a-fA-F]{40}$/.test(addressPart)) {
        results.push({
          type: "address",
          value: addressPart,
          label: "storage.asAddress",
        });
      }
    }
  } catch {
    // ignore
  }

  return results;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function StoragePage() {
  const { t } = useLocaleStore();
  const { selectedChainId, setChain, customChains, customRpcs } =
    useChainStore();

  const [contractAddress, setContractAddress] = useState("");
  const [slot, setSlot] = useState("0x0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const allConfigs = getAllChainConfigs(customChains);

  // Resolve the RPC URL for the selected chain
  const getRpcUrl = useCallback((): string | undefined => {
    if (customRpcs[selectedChainId]) return customRpcs[selectedChainId];
    const custom = customChains.find((c) => c.id === selectedChainId);
    return custom?.rpcUrl;
  }, [selectedChainId, customRpcs, customChains]);

  // Resolve chain metadata for custom chains
  const getChainMeta = useCallback(() => {
    const custom = customChains.find((c) => c.id === selectedChainId);
    if (!custom) return undefined;
    return {
      name: custom.name,
      nativeCurrencySymbol: custom.nativeCurrencySymbol,
      nativeCurrencyDecimals: custom.nativeCurrencyDecimals,
    };
  }, [selectedChainId, customChains]);

  // Read storage
  const handleRead = useCallback(async () => {
    if (!contractAddress.trim()) {
      toast.error(t("toast.enterAddress"));
      return;
    }

    // Basic address validation
    if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress.trim())) {
      toast.error(t("toast.invalidAddress"));
      return;
    }

    if (!slot.trim().startsWith("0x")) {
      toast.error(t("toast.invalidHex"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const rpcUrl = getRpcUrl();
      const chainMeta = getChainMeta();
      const publicClient = getPublicClient(selectedChainId, rpcUrl, chainMeta);

      const value = await publicClient.getStorageAt({
        address: contractAddress.trim() as `0x${string}`,
        slot: slot.trim() as `0x${string}`,
      });

      setResult(value ?? null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to read storage slot"
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddress, slot, selectedChainId, getRpcUrl, getChainMeta, t]);

  // Copy helper
  const copyToClipboard = useCallback(
    (text: string, fieldId: string) => {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success(t("common.copied"));
      setTimeout(() => setCopiedField(null), 2000);
    },
    [t]
  );

  // Select a quick slot
  const selectSlot = useCallback((slotValue: string) => {
    setSlot(slotValue);
  }, []);

  const interpretations = result ? interpretStorageValue(result) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="h-6 w-6 text-zinc-400" />
          {t("storage.title")}
        </h1>
        <p className="text-zinc-400 mt-1">{t("storage.description")}</p>
      </div>

      {/* Input card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">{t("storage.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chain selector */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("contract.chain")}</Label>
            <Select
              value={String(selectedChainId)}
              onValueChange={(value) => setChain(Number(value))}
            >
              <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                <SelectValue>
                  {allConfigs[selectedChainId] ? (
                    <span className="flex items-center gap-2">
                      <img
                        src={allConfigs[selectedChainId].icon}
                        alt={allConfigs[selectedChainId].name}
                        className="h-4 w-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span>{allConfigs[selectedChainId].name}</span>
                    </span>
                  ) : (
                    t("header.selectChain")
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {supportedChains.map((chain) => {
                  const config = allConfigs[chain.id];
                  if (!config) return null;
                  return (
                    <SelectItem
                      key={chain.id}
                      value={String(chain.id)}
                      className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                    >
                      <span className="flex items-center gap-2">
                        <img
                          src={config.icon}
                          alt={config.name}
                          className="h-4 w-4"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <span>{config.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
                {customChains.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-zinc-500 border-t border-zinc-800 mt-1 pt-2">
                      Custom
                    </div>
                    {customChains.map((chain) => {
                      const config = allConfigs[chain.id];
                      if (!config) return null;
                      return (
                        <SelectItem
                          key={chain.id}
                          value={String(chain.id)}
                          className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                        >
                          <span className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                            <span>{config.name}</span>
                            <Badge
                              variant="outline"
                              className="ml-auto text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-400"
                            >
                              Custom
                            </Badge>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Contract address */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("storage.address")}</Label>
            <Input
              placeholder="0x..."
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
            />
          </div>

          {/* Storage slot */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("storage.slot")}</Label>
            <Input
              placeholder="0x0"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
            />
          </div>

          {/* Quick slot buttons */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("storage.commonSlots")}</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SLOTS.map((s) => (
                <Button
                  key={s.label + s.slot}
                  variant="outline"
                  size="sm"
                  onClick={() => selectSlot(s.slot)}
                  className={
                    slot === s.slot
                      ? "border-zinc-500 text-white bg-zinc-700"
                      : "border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Read button */}
          <Button
            onClick={handleRead}
            disabled={loading}
            className="w-full bg-white text-zinc-900 hover:bg-zinc-200"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("storage.reading")}
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                {t("storage.read")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result card */}
      {result !== null && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {t("storage.value")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Interpretations */}
            <div className="space-y-3">
              {interpretations.map((interp, idx) => (
                <div
                  key={interp.type}
                  className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-zinc-600 text-zinc-300 text-xs"
                      >
                        {interp.type}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {t("storage.interpretedAs")} {interp.type}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(interp.value, `${interp.type}-${idx}`)
                      }
                      className="h-7 px-2 text-zinc-400 hover:text-white"
                    >
                      {copiedField === `${interp.type}-${idx}` ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-white font-mono text-sm break-all">
                    {interp.type === "address"
                      ? interp.value
                      : interp.type === "bool"
                        ? interp.value
                        : interp.type === "uint256"
                          ? interp.value
                          : interp.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
