"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Upload, Link as LinkIcon, BookOpen, Eye, Send, ArrowLeft, AlertTriangle, Sparkles, Star, Trash2, FileUp } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useChainStore } from "@/stores/chain-store";
import { parseAbiMethods, getFunctionMethods, type AbiMethod } from "@/lib/abi/parser";
import { getChainConfig } from "@/lib/web3";
import { toast } from "sonner";
import { MethodForm } from "@/components/contract/method-form";
import { useLocaleStore } from "@/stores/locale-store";
import { useAiStore } from "@/stores/ai-store";
import { AIGateway, type ParsedCallIntent } from "@/lib/ai";
import { useFavoritesStore, type FavoriteContract } from "@/stores/favorites-store";
import { openFile } from "@/lib/tauri";

export default function HomePage() {
  const [address, setAddress] = useState("");
  const [abiInput, setAbiInput] = useState("");
  const { currentContract, abi, setContract, setAbi, clear } = useContractStore();
  const { selectedChainId } = useChainStore();
  const chainConfig = getChainConfig(selectedChainId);
  const { t } = useLocaleStore();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  // If a contract is loaded, show the interaction view
  if (currentContract && abi.length > 0) {
    return <ContractInteractionView />;
  }

  function handleLoadContract() {
    if (!address.trim()) {
      toast.error(t("toast.enterAddress"));
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      toast.error(t("toast.invalidAddress"));
      return;
    }

    const parsedAbi: AbiMethod[] = abiInput.trim()
      ? (() => {
          try {
            return parseAbiMethods(abiInput);
          } catch (e) {
            toast.error(t("toast.invalidAbi") + ": " + (e as Error).message);
            return [] as AbiMethod[];
          }
        })()
      : [];

    if (abiInput.trim() && parsedAbi.length === 0 && abiInput.includes("[")) {
      return;
    }

    setContract({
      id: crypto.randomUUID(),
      address: address.trim() as `0x${string}`,
      chainId: selectedChainId as 1 | 42161 | 10 | 8453 | 137 | 56,
      isVerified: parsedAbi.length > 0,
      createdAt: Date.now(),
    });
    setAbi(parsedAbi);
    toast.success(t("toast.contractLoaded"));
  }

  function handleLoadErc20() {
    const sampleAbi = JSON.stringify([
      { "name": "balanceOf", "type": "function", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
      { "name": "transfer", "type": "function", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
      { "name": "approve", "type": "function", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
      { "name": "allowance", "type": "function", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
      { "name": "totalSupply", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
      { "name": "name", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
      { "name": "symbol", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
      { "name": "decimals", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
    ]);
    setAbiInput(sampleAbi);
    toast.success(t("toast.erc20Loaded"));
  }

  function handleLoadErc721() {
    const sampleAbi = JSON.stringify([
      { "name": "balanceOf", "type": "function", "inputs": [{ "name": "owner", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
      { "name": "ownerOf", "type": "function", "inputs": [{ "name": "tokenId", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
      { "name": "approve", "type": "function", "inputs": [{ "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "getApproved", "type": "function", "inputs": [{ "name": "tokenId", "type": "uint256" }], "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view" },
      { "name": "setApprovalForAll", "type": "function", "inputs": [{ "name": "operator", "type": "address" }, { "name": "approved", "type": "bool" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "isApprovedForAll", "type": "function", "inputs": [{ "name": "owner", "type": "address" }, { "name": "operator", "type": "address" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
      { "name": "transferFrom", "type": "function", "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "safeTransferFrom", "type": "function", "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "tokenId", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "tokenURI", "type": "function", "inputs": [{ "name": "tokenId", "type": "uint256" }], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
      { "name": "name", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
      { "name": "symbol", "type": "function", "inputs": [], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
    ]);
    setAbiInput(sampleAbi);
    toast.success(t("toast.erc721Loaded"));
  }

  function handleLoadErc1155() {
    const sampleAbi = JSON.stringify([
      { "name": "balanceOf", "type": "function", "inputs": [{ "name": "account", "type": "address" }, { "name": "id", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
      { "name": "balanceOfBatch", "type": "function", "inputs": [{ "name": "accounts", "type": "address[]" }, { "name": "ids", "type": "uint256[]" }], "outputs": [{ "name": "", "type": "uint256[]" }], "stateMutability": "view" },
      { "name": "safeTransferFrom", "type": "function", "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "id", "type": "uint256" }, { "name": "amount", "type": "uint256" }, { "name": "data", "type": "bytes" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "safeBatchTransferFrom", "type": "function", "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "ids", "type": "uint256[]" }, { "name": "amounts", "type": "uint256[]" }, { "name": "data", "type": "bytes" }], "outputs": [], "stateMutability": "nonpayable" },
      { "name": "uri", "type": "function", "inputs": [{ "name": "id", "type": "uint256" }], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
      { "name": "isApprovedForAll", "type": "function", "inputs": [{ "name": "account", "type": "address" }, { "name": "operator", "type": "address" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
      { "name": "setApprovalForAll", "type": "function", "inputs": [{ "name": "operator", "type": "address" }, { "name": "approved", "type": "bool" }], "outputs": [], "stateMutability": "nonpayable" },
    ]);
    setAbiInput(sampleAbi);
    toast.success(t("toast.erc1155Loaded"));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">{t("home.title")}</h1>
        <p className="text-zinc-400 text-sm">
          {t("home.description")}
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            {t("home.loadContract")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("home.loadContract")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-zinc-300">{t("home.contractAddress")}</Label>
            <Input
              id="address"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
            />
          </div>

          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="bg-zinc-800 border-zinc-700">
              <TabsTrigger value="paste" className="data-[state=active]:bg-zinc-700">
                <Upload className="h-3 w-3 mr-1" /> {t("home.pasteAbi")}
              </TabsTrigger>
              <TabsTrigger value="sample" className="data-[state=active]:bg-zinc-700">
                <BookOpen className="h-3 w-3 mr-1" /> {t("home.sample")}
              </TabsTrigger>
              <TabsTrigger value="favorites" className="data-[state=active]:bg-zinc-700">
                <Star className="h-3 w-3 mr-1" /> {t("contract.favorites")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-3 space-y-2">
              <Textarea
                placeholder='[{"name": "balanceOf", "type": "function", ...}]'
                value={abiInput}
                onChange={(e) => setAbiInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono text-xs min-h-[120px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const content = await openFile([{ name: "ABI JSON", extensions: ["json", "txt"] }]);
                  if (content) {
                    setAbiInput(content);
                    toast.success(t("toast.fileImported"));
                  }
                }}
                className="border-zinc-700 text-zinc-300"
              >
                <FileUp className="h-3 w-3 mr-1" /> {t("common.importFile")}
              </Button>
            </TabsContent>
            <TabsContent value="sample" className="mt-3 space-y-2">
              <p className="text-zinc-400 text-sm">{t("home.loadSampleAbi")}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleLoadErc20} className="border-zinc-700 text-zinc-300">
                  ERC-20
                </Button>
                <Button variant="outline" size="sm" onClick={handleLoadErc721} className="border-zinc-700 text-zinc-300">
                  ERC-721
                </Button>
                <Button variant="outline" size="sm" onClick={handleLoadErc1155} className="border-zinc-700 text-zinc-300">
                  ERC-1155
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="favorites" className="mt-3 space-y-2">
              {favorites.length === 0 ? (
                <div className="text-center py-6">
                  <Star className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">{t("contract.noFavorites")}</p>
                  <p className="text-zinc-500 text-xs">{t("contract.noFavoritesDesc")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {favorites.map((fav) => (
                    <div key={fav.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{fav.name || fav.address.slice(0, 10) + "..."}</span>
                          <span className="text-zinc-500 text-xs">{getChainConfig(fav.chainId)?.name ?? `Chain ${fav.chainId}`}</span>
                        </div>
                        <p className="text-zinc-500 text-xs font-mono truncate">{fav.address}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddress(fav.address);
                          setAbiInput(fav.abiJson);
                          toast.success(t("toast.contractLoaded"));
                        }}
                        className="border-zinc-700 text-zinc-300 shrink-0 h-7"
                      >
                        {t("contract.loadFavorite")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeFavorite(fav.id);
                          toast.success(t("toast.unfavorited"));
                        }}
                        className="text-zinc-500 hover:text-red-400 shrink-0 h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Button onClick={handleLoadContract} className="w-full" size="lg">
            <LinkIcon className="h-4 w-4 mr-2" />
            {t("home.loadContract")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract Interaction View (shown when contract is loaded)
// ---------------------------------------------------------------------------

function ContractInteractionView() {
  const { currentContract, abi, clear } = useContractStore();
  const { selectedChainId } = useChainStore();
  const chainConfig = getChainConfig(selectedChainId);
  const { t } = useLocaleStore();
  const aiStore = useAiStore();
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const [nlInput, setNlInput] = useState("");
  const [parsedIntent, setParsedIntent] = useState<ParsedCallIntent | null>(null);
  const [parsing, setParsing] = useState(false);

  if (!currentContract) return null;

  const { read, write } = getFunctionMethods(abi);

  const handleToggleFavorite = () => {
    if (isFavorite(currentContract.address, currentContract.chainId)) {
      const fav = useFavoritesStore.getState().getFavorite(currentContract.address, currentContract.chainId);
      if (fav) {
        removeFavorite(fav.id);
        toast.success(t("toast.unfavorited"));
      }
    } else {
      addFavorite({
        id: crypto.randomUUID(),
        address: currentContract.address,
        chainId: currentContract.chainId,
        abiJson: JSON.stringify(abi),
        timestamp: Date.now(),
      });
      toast.success(t("toast.favorited"));
    }
  };

  async function handleParseNL() {
    if (!nlInput.trim()) return;
    if (!aiStore.apiKey && aiStore.provider !== "ollama") {
      toast.error(t("contract.configureAiFirst"));
      return;
    }
    setParsing(true);
    try {
      const gateway = new AIGateway();
      const result = await gateway.parseNaturalLanguage(
        {
          provider: aiStore.provider,
          apiKey: aiStore.apiKey,
          baseUrl: aiStore.baseUrl,
          ollamaUrl: aiStore.ollamaUrl,
          modelId: aiStore.modelId,
        },
        nlInput,
      );
      setParsedIntent(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  const allMethods = [...read, ...write];
  const methodInAbi = parsedIntent ? allMethods.find(m => m.name === parsedIntent.methodName) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-zinc-400 hover:text-white -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("contract.back")}
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{t("home.title")}</h1>
            <p className="text-zinc-500 font-mono text-xs truncate">
              {currentContract.address}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {chainConfig && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                {chainConfig.name}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFavorite}
              className={`h-8 w-8 p-0 ${isFavorite(currentContract.address, currentContract.chainId) ? "text-yellow-400" : "text-zinc-500 hover:text-yellow-400"}`}
            >
              <Star className={`h-4 w-4 ${isFavorite(currentContract.address, currentContract.chainId) ? "fill-yellow-400" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-zinc-500 text-xs">{t("contract.address")}</span>
              <p className="text-white font-mono text-xs break-all">{currentContract.address}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500 text-xs">{t("contract.chain")}</span>
              <p className="text-white">{chainConfig?.name ?? `Chain ${selectedChainId}`}</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500 text-xs">{t("contract.abiMethods")}</span>
              <p className="text-white">{abi.length} {t("contract.total")} ({read.length} {t("contract.read").toLowerCase()}, {write.length} {t("contract.write").toLowerCase()})</p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500 text-xs">{t("contract.verified")}</span>
              <p className="text-white">{currentContract.isVerified ? t("contract.yes") : t("contract.no")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Natural Language Input */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-violet-400" />
            {t("contract.nlParsedIntent")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("contract.nlPrompt")}
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParseNL()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
            />
            <Button
              size="sm"
              onClick={handleParseNL}
              disabled={parsing || !nlInput.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            >
              {parsing ? <span className="animate-pulse">{t("contract.nlParsing")}</span> : t("contract.nlParse")}
            </Button>
          </div>
          {parsedIntent && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">{t("contract.nlMethodName")}:</span>
                <span className="text-white font-mono">{parsedIntent.methodName}</span>
                <Badge variant="outline" className={`text-[10px] ${methodInAbi ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}`}>
                  {methodInAbi ? t("contract.nlMethodFound") : t("contract.nlMethodNotFound")}
                </Badge>
              </div>
              {parsedIntent.params.length > 0 && (
                <div>
                  <span className="text-zinc-500">{t("contract.nlParams")}:</span>
                  <ul className="list-disc list-inside text-zinc-300 mt-1">
                    {parsedIntent.params.map((p, i) => (
                      <li key={i}><span className="font-mono text-emerald-400">{p.name}</span> ({p.type}): {p.value}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-zinc-500">{parsedIntent.originalIntent}</div>
              <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-[10px]">
                Confidence: {parsedIntent.confidence}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Methods Tabs */}
      <Tabs defaultValue="read">
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger value="read" className="data-[state=active]:bg-zinc-700 text-zinc-300">
            <Eye className="h-3 w-3 mr-1" /> Read ({read.length})
          </TabsTrigger>
          <TabsTrigger value="write" className="data-[state=active]:bg-zinc-700 text-zinc-300">
            <Send className="h-3 w-3 mr-1" /> Write ({write.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="read" className="mt-4">
          <ScrollArea className="h-[calc(100vh-360px)]">
            {read.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-8 text-center">
                  <p className="text-zinc-500 text-sm">{t("contract.noReadMethods")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 pr-4">
                {read.map((method, i) => (
                  <MethodForm
                    key={`${method.name}-${i}`}
                    method={method}
                    contractAddress={currentContract.address}
                    chainId={selectedChainId}
                    isRead
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="write" className="mt-4">
          <ScrollArea className="h-[calc(100vh-360px)]">
            {write.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-8 text-center">
                  <p className="text-zinc-500 text-sm">{t("contract.noWriteMethods")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 pr-4">
                {write.map((method, i) => (
                  <MethodForm
                    key={`${method.name}-${i}`}
                    method={method}
                    contractAddress={currentContract.address}
                    chainId={selectedChainId}
                    isRead={false}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
