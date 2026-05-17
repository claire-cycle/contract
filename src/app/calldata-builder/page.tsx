"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Hexagon, Send, Eye } from "lucide-react";
import { useChainStore } from "@/stores/chain-store";
import { chainConfigMap } from "@/lib/web3";
import { toast } from "sonner";
import { useLocaleStore } from "@/stores/locale-store";

// ---------------------------------------------------------------------------
// Decode helpers
// ---------------------------------------------------------------------------

interface DecodedCall {
  selector: string;
  params: {
    offset: number;
    length: number;
    raw: string;
  }[];
}

function decodeCalldata(data: string): DecodedCall | null {
  const clean = data.startsWith("0x") ? data.slice(2) : data;
  if (clean.length < 8) return null;

  const selector = "0x" + clean.slice(0, 8).toLowerCase();
  const paramData = clean.slice(8);

  if (!paramData) {
    return { selector, params: [] };
  }

  // Split remaining data into 32-byte chunks
  const params: DecodedCall["params"] = [];
  for (let i = 0; i + 64 <= paramData.length; i += 64) {
    const chunk = paramData.slice(i, i + 64);
    params.push({
      offset: i / 2,
      length: 32,
      raw: "0x" + chunk,
    });
  }

  return { selector, params };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalldataBuilderPage() {
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [data, setData] = useState("");
  const [decoded, setDecoded] = useState<DecodedCall | null>(null);

  const { selectedChainId } = useChainStore();
  const { t } = useLocaleStore();
  const chainConfig = chainConfigMap[selectedChainId as keyof typeof chainConfigMap];

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(to.trim());
  const isValidData = !data.trim() || /^0x[a-fA-F0-9]*$/.test(data.trim());
  const isValidValue = !value.trim() || /^\d+$/.test(value.trim());

  const handleDecode = () => {
    const trimmed = data.trim();
    if (!trimmed) {
      toast.error(t("toast.noDataToDecode"));
      return;
    }
    if (!/^0x[a-fA-F0-9]+$/.test(trimmed)) {
      toast.error(t("toast.invalidHex"));
      return;
    }
    const result = decodeCalldata(trimmed);
    setDecoded(result);
    if (!result) {
      toast.error(t("toast.dataTooShort"));
    }
  };

  const transactionPayload = useMemo(() => {
    if (!to.trim() && !value.trim() && !data.trim()) return null;

    const payload: Record<string, string> = {};
    if (to.trim()) {
      payload.to = to.trim();
    }
    if (value.trim()) {
      payload.value = `0x${BigInt(value.trim() || "0").toString(16)}`;
    }
    if (data.trim()) {
      payload.data = data.trim();
    }
    return JSON.stringify(payload, null, 2);
  }, [to, value, data]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Hexagon className="h-6 w-6" />
          {t("calldata.title")}
        </h1>
        <p className="text-zinc-400 text-sm">
          {t("calldata.description")}
        </p>
      </div>

      {/* Input Form */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("calldata.transactionFields")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("calldata.buildPayload")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to" className="text-zinc-300">{t("calldata.to")}</Label>
            <Input
              id="to"
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono ${
                to && !isValidAddress ? "border-red-500/50" : ""
              }`}
            />
            {to && !isValidAddress && (
              <p className="text-red-400 text-xs">Invalid address format</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value" className="text-zinc-300">{t("calldata.value")}</Label>
            <Input
              id="value"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono ${
                value && !isValidValue ? "border-red-500/50" : ""
              }`}
            />
            {value && !isValidValue && (
              <p className="text-red-400 text-xs">Value must be a non-negative integer</p>
            )}
            {value && isValidValue && value !== "0" && (
              <p className="text-zinc-500 text-xs">
                {chainConfig?.nativeCurrency.symbol || "ETH"}: {(Number(value) / 1e18).toFixed(8)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="data" className="text-zinc-300">{t("calldata.data")}</Label>
            <Textarea
              id="data"
              placeholder="0x..."
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                setDecoded(null);
              }}
              className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono text-xs min-h-[100px] ${
                data && !isValidData ? "border-red-500/50" : ""
              }`}
            />
            {data && !isValidData && (
              <p className="text-red-400 text-xs">Invalid hex format</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t("calldata.transactionPreview")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactionPayload ? (
            <pre className="bg-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {transactionPayload}
            </pre>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">
              {t("calldata.previewPlaceholder")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Decode */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Hexagon className="h-4 w-4" />
              {t("calldata.decodeCalldata")}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecode}
              className="border-zinc-700 text-zinc-300"
            >
              {t("calldata.decode")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {decoded ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">{t("calldata.functionSelector")}</Label>
                <p className="text-white font-mono text-sm bg-zinc-800 rounded-lg px-3 py-2">
                  {decoded.selector}
                </p>
              </div>
              {decoded.params.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs">
                    {t("calldata.parameters")} ({decoded.params.length} x 32 bytes)
                  </Label>
                  <div className="space-y-1.5">
                    {decoded.params.map((param, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-800 rounded-lg px-3 py-2 flex items-start gap-3"
                      >
                        <span className="text-zinc-500 text-xs font-mono min-w-[60px] pt-0.5">
                          [{idx}] @{param.offset}
                        </span>
                        <span className="text-zinc-300 font-mono text-xs break-all">
                          {param.raw}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {decoded.params.length === 0 && (
                <p className="text-zinc-500 text-sm">
                  {t("calldata.noParams")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">
              {t("calldata.clickDecode")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
