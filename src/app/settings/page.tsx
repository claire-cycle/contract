"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Key, Bot, Globe, Wallet, Eye, EyeOff, Languages, Plus, Trash2, Pencil, Sun, Moon, Monitor } from "lucide-react";
import { useAiStore, type AiProvider } from "@/stores/ai-store";
import { useChainStore, type CustomChain } from "@/stores/chain-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useSettingsStore, type Theme } from "@/stores/settings-store";
import { supportedChains, chainConfigMap, getAllChainConfigs } from "@/lib/web3";
import type { Locale } from "@/lib/i18n";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { locale, setLocale, t } = useLocaleStore();
  const { address, connected, importWallet, disconnect } = useWalletStore();
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  const {
    provider,
    apiKey,
    baseUrl,
    ollamaUrl,
    modelId,
    setProvider,
    setApiKey,
    setBaseUrl,
    setOllamaUrl,
    setModelId,
  } = useAiStore();

  const { customRpcs, customChains, setCustomRpc, removeCustomRpc, addCustomChain, removeCustomChain, updateCustomChain } = useChainStore();
  const { theme, setTheme, etherscanApiKey, setEtherscanApiKey } = useSettingsStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [rpcInputs, setRpcInputs] = useState<Record<number, string>>(customRpcs);
  const [editingChain, setEditingChain] = useState<Partial<CustomChain> & { isNew?: boolean } | null>(null);

  const handleProviderChange = (value: string | null) => {
    if (value) setProvider(value as AiProvider);
  };

  const handleSaveRpc = (chainId: number) => {
    const url = rpcInputs[chainId]?.trim();
    if (!url) {
      removeCustomRpc(chainId);
      toast.success(t("toast.rpcRemoved"));
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error(t("toast.invalidUrl"));
      return;
    }
    setCustomRpc(chainId, url);
    toast.success(t("toast.rpcSaved"));
  };

  const allChainConfigs = getAllChainConfigs(customChains);

  const handleAddCustomChain = () => {
    setEditingChain({ isNew: true, id: 0, name: "", rpcUrl: "", blockExplorerUrl: "", nativeCurrencySymbol: "ETH", nativeCurrencyName: "Ether", nativeCurrencyDecimals: 18, color: "#627EEA" });
  };

  const handleSaveCustomChain = () => {
    if (!editingChain) return;
    const { id, name, rpcUrl, blockExplorerUrl, nativeCurrencySymbol, nativeCurrencyName, nativeCurrencyDecimals, color } = editingChain;
    if (!id || !name?.trim() || !rpcUrl?.trim()) {
      toast.error("Chain ID, Name, and RPC URL are required");
      return;
    }
    try {
      new URL(rpcUrl);
    } catch {
      toast.error(t("toast.invalidUrl"));
      return;
    }
    if (editingChain.isNew) {
      if (customChains.some(c => c.id === id) || chainConfigMap[id]) {
        toast.error(t("toast.duplicateChainId"));
        return;
      }
      addCustomChain({ id, name: name.trim(), rpcUrl: rpcUrl.trim(), blockExplorerUrl: blockExplorerUrl?.trim() || "", nativeCurrencySymbol: nativeCurrencySymbol || "ETH", nativeCurrencyName: nativeCurrencyName || "Ether", nativeCurrencyDecimals: nativeCurrencyDecimals ?? 18, color: color || "#627EEA" });
      toast.success(t("toast.customChainAdded"));
    } else {
      updateCustomChain(id, { name: name.trim(), rpcUrl: rpcUrl.trim(), blockExplorerUrl: blockExplorerUrl?.trim() || "", nativeCurrencySymbol: nativeCurrencySymbol || "ETH", nativeCurrencyName: nativeCurrencyName || "Ether", nativeCurrencyDecimals: nativeCurrencyDecimals ?? 18, color: color || "#627EEA" });
      toast.success(t("toast.customChainUpdated"));
    }
    setEditingChain(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {t("settings.title")}
        </h1>
        <p className="text-zinc-400 text-sm">
          {t("settings.description")}
        </p>
      </div>

      {/* Wallet */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t("settings.wallet")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.walletDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && address ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-zinc-300">{t("settings.importedAddress")}</Label>
                <p className="text-white font-mono text-sm bg-zinc-800 rounded-lg px-3 py-2 break-all">
                  {address}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                {t("settings.removeWallet")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-zinc-300">{t("settings.privateKey")}</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={t("settings.enterPrivateKey")}
                    value={privateKeyInput}
                    onChange={(e) => setPrivateKeyInput(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-400 hover:text-white"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-zinc-500 text-xs">
                  {t("settings.walletWarning")}
                </p>
              </div>
              <Button
                onClick={() => {
                  try {
                    importWallet(privateKeyInput)
                    setPrivateKeyInput("")
                    toast.success(t("toast.walletImported"))
                  } catch {
                    toast.error(t("toast.invalidPrivateKey"))
                  }
                }}
                disabled={!privateKeyInput.trim()}
                className="w-full"
              >
                {t("settings.importWallet")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {t("settings.language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="zh" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">中文</SelectItem>
              <SelectItem value="en" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : theme === "light" ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            {t("settings.theme")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {([["dark", Moon, t("settings.themeDark")], ["light", Sun, t("settings.themeLight")], ["system", Monitor, t("settings.themeSystem")]] as const).map(([value, Icon, label]) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(value as Theme)}
                className={theme === value ? "bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300"}
              >
                <Icon className="h-4 w-4 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Etherscan API Key */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("settings.etherscanKey")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="password"
            placeholder="Optional API key..."
            value={etherscanApiKey}
            onChange={(e) => setEtherscanApiKey(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono"
          />
          <p className="text-zinc-500 text-xs">{t("settings.etherscanKeyHint")}</p>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t("settings.aiConfiguration")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.aiDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("settings.provider")}</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="claude" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  Claude (Anthropic)
                </SelectItem>
                <SelectItem value="openai" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  OpenAI
                </SelectItem>
                <SelectItem value="glm" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  GLM (智谱 AI)
                </SelectItem>
                <SelectItem value="deepseek" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  DeepSeek
                </SelectItem>
                <SelectItem value="minimax" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  MiniMax
                </SelectItem>
                <SelectItem value="mimo" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  MiMo (小米)
                </SelectItem>
                <SelectItem value="qwen" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  Qwen (通义千问)
                </SelectItem>
                <SelectItem value="ollama" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  Ollama (Local)
                </SelectItem>
                <SelectItem value="custom" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                  Custom (OpenAI Compatible)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          {provider !== "ollama" && (
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Key className="h-3.5 w-3.5" />
                {t("settings.apiKey")}
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={
                    provider === "claude" ? "sk-ant-..."
                    : provider === "openai" ? "sk-..."
                    : provider === "glm" ? "zhipu-..."
                    : provider === "deepseek" ? "sk-..."
                    : "Enter API key..."
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-400 hover:text-white"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-zinc-500 text-xs">
                {t("settings.apiKeyHint")}
              </p>
            </div>
          )}

          {/* Ollama URL */}
          {provider === "ollama" && (
            <div className="space-y-2">
              <Label className="text-zinc-300">{t("settings.ollamaUrl")}</Label>
              <Input
                type="url"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <p className="text-zinc-500 text-xs">
                {t("settings.ollamaHint")}
              </p>
            </div>
          )}

          {/* Base URL */}
          {provider !== "ollama" && (
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                {t("settings.baseUrl")}
              </Label>
              <Input
                type="url"
                placeholder={
                  provider === "claude" ? "https://api.anthropic.com"
                  : provider === "openai" ? "https://api.openai.com/v1"
                  : provider === "glm" ? "https://open.bigmodel.cn/api/paas/v1"
                  : provider === "deepseek" ? "https://api.deepseek.com/v1"
                  : provider === "minimax" ? "https://api.minimax.chat/v1"
                  : provider === "mimo" ? "https://api.minimax.chat/v1"
                  : provider === "qwen" ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
                  : "https://api.example.com/v1"
                }
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono text-xs"
              />
              <p className="text-zinc-500 text-xs">
                {t("settings.baseUrlHint")}
              </p>
            </div>
          )}

          {/* Model ID */}
          <div className="space-y-2">
            <Label className="text-zinc-300">{t("settings.modelId")}</Label>
            <Input
              placeholder={
                provider === "claude" ? "claude-sonnet-4-6-20250627"
                : provider === "openai" ? "gpt-4o"
                : provider === "glm" ? "glm-4-flash"
                : provider === "deepseek" ? "deepseek-chat"
                : provider === "minimax" ? "MiniMax-Text-01"
                : provider === "mimo" ? "MiMo-7B-RL"
                : provider === "qwen" ? "qwen-plus"
                : provider === "ollama" ? "llama3.1"
                : "model-id"
              }
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <p className="text-zinc-500 text-xs">
              {provider === "claude"
                ? "Recommended: claude-sonnet-4-6-20250627"
                : provider === "openai"
                ? "Recommended: gpt-4o, gpt-4o-mini"
                : provider === "glm"
                ? "Available: glm-4-flash, glm-4-plus, glm-4-long, glm-4"
                : provider === "deepseek"
                ? "Available: deepseek-chat, deepseek-reasoner"
                : provider === "minimax"
                ? "Available: MiniMax-Text-01, abab6.5s-chat"
                : provider === "mimo"
                ? "Available: MiMo-7B-RL"
                : provider === "qwen"
                ? "Available: qwen-plus, qwen-turbo, qwen-max"
                : provider === "ollama"
                ? "Example: llama3.1, codellama, mistral"
                : "Enter the model ID provided by your API"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chain Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("settings.chainConfiguration")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.chainDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {supportedChains.map((chain, idx) => {
            const config = chainConfigMap[chain.id as keyof typeof chainConfigMap];
            if (!config) return null;

            const currentRpc = rpcInputs[chain.id] || customRpcs[chain.id] || "";

            return (
              <div key={chain.id}>
                {idx > 0 && <Separator className="bg-zinc-800 my-3" />}
                <div className="flex items-center gap-3">
                  {/* Chain info */}
                  <div className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-white text-sm font-medium">
                        {config.name}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs ml-5">Chain ID: {chain.id}</p>
                  </div>

                  {/* RPC input */}
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      placeholder={t("settings.useDefaultRpc")}
                      value={currentRpc}
                      onChange={(e) =>
                        setRpcInputs((prev) => ({
                          ...prev,
                          [chain.id]: e.target.value,
                        }))
                      }
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 font-mono text-xs h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveRpc(chain.id)}
                      className="border-zinc-700 text-zinc-300 shrink-0 h-8"
                    >
                      {t("settings.save")}
                    </Button>
                    {customRpcs[chain.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeCustomRpc(chain.id);
                          setRpcInputs((prev) => {
                            const next = { ...prev };
                            delete next[chain.id];
                            return next;
                          });
                          toast.success(t("toast.rpcRemoved"));
                        }}
                        className="text-zinc-500 hover:text-red-400 shrink-0 h-8"
                      >
                        {t("settings.reset")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Custom Chains */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("settings.customChains")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.customChainsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing custom chains */}
          {customChains.length > 0 && (
            <div className="space-y-2">
              {customChains.map((chain) => (
                <div key={chain.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: chain.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{chain.name}</span>
                      <span className="text-zinc-500 text-xs">ID: {chain.id}</span>
                    </div>
                    <p className="text-zinc-500 text-xs truncate">{chain.rpcUrl}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingChain({ ...chain, isNew: false })}
                    className="text-zinc-400 hover:text-white shrink-0 h-7 w-7 p-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      removeCustomChain(chain.id);
                      toast.success(t("toast.customChainRemoved"));
                    }}
                    className="text-zinc-400 hover:text-red-400 shrink-0 h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {!editingChain && (
            <Button
              variant="outline"
              onClick={handleAddCustomChain}
              className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.addCustomChain")}
            </Button>
          )}

          {/* Edit / Add form */}
          {editingChain && (
            <div className="space-y-3 bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t("settings.chainId")}</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 43114"
                    value={editingChain.id || ""}
                    onChange={(e) => setEditingChain({ ...editingChain, id: Number(e.target.value) })}
                    disabled={!editingChain.isNew}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t("settings.chainName")}</Label>
                  <Input
                    placeholder="e.g. Avalanche"
                    value={editingChain.name || ""}
                    onChange={(e) => setEditingChain({ ...editingChain, name: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm h-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">{t("settings.chainRpcUrl")}</Label>
                <Input
                  placeholder="https://..."
                  value={editingChain.rpcUrl || ""}
                  onChange={(e) => setEditingChain({ ...editingChain, rpcUrl: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">{t("settings.chainExplorerUrl")}</Label>
                <Input
                  placeholder="https://..."
                  value={editingChain.blockExplorerUrl || ""}
                  onChange={(e) => setEditingChain({ ...editingChain, blockExplorerUrl: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm h-8 font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t("settings.chainNativeSymbol")}</Label>
                  <Input
                    placeholder="ETH"
                    value={editingChain.nativeCurrencySymbol || ""}
                    onChange={(e) => setEditingChain({ ...editingChain, nativeCurrencySymbol: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t("settings.chainNativeName")}</Label>
                  <Input
                    placeholder="Ether"
                    value={editingChain.nativeCurrencyName || ""}
                    onChange={(e) => setEditingChain({ ...editingChain, nativeCurrencyName: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t("settings.chainColor")}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingChain.color || "#627EEA"}
                      onChange={(e) => setEditingChain({ ...editingChain, color: e.target.value })}
                      className="h-8 w-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={editingChain.color || "#627EEA"}
                      onChange={(e) => setEditingChain({ ...editingChain, color: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 text-white text-sm h-8 font-mono flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingChain(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCustomChain}
                >
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
