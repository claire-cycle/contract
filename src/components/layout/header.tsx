"use client"

import { Menu, Wallet, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useUiStore } from "@/stores/ui-store"
import { useChainStore } from "@/stores/chain-store"
import { useWalletStore } from "@/stores/wallet-store"
import { useLocaleStore } from "@/stores/locale-store"
import { supportedChains, chainConfigMap, getAllChainConfigs, type SupportedChainId } from "@/lib/web3"
import type { Locale } from "@/lib/i18n"

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function Header() {
  const { toggleSidebar } = useUiStore()
  const { selectedChainId, setChain, customChains } = useChainStore()
  const { address, connected, disconnect } = useWalletStore()
  const { locale, setLocale, t } = useLocaleStore()

  const allConfigs = getAllChainConfigs(customChains)
  const selectedConfig = allConfigs[selectedChainId]

  return (
    <header className="flex items-center h-14 px-4 border-b border-zinc-800 bg-zinc-950 shrink-0 gap-3">
      {/* Left: Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="text-zinc-400 hover:text-white hover:bg-zinc-800"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Center: Chain selector */}
      <div className="flex-1 flex justify-center">
        <Select
          value={String(selectedChainId)}
          onValueChange={(value) => {
            setChain(Number(value))
          }}
        >
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-white">
            <SelectValue>
              {selectedConfig ? (
                <span className="flex items-center gap-2">
                  <img
                    src={selectedConfig.icon}
                    alt={selectedConfig.name}
                    className="h-4 w-4"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                  <span>{selectedConfig.name}</span>
                </span>
              ) : (
                t("header.selectChain")
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {supportedChains.map((chain) => {
              const config = allConfigs[chain.id]
              if (!config) return null
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
                        ;(e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                    <span>{config.name}</span>
                    {chain.id === 1 ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] px-1.5 py-0"
                      >
                        Mainnet
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="ml-auto text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-400"
                      >
                        L2
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              )
            })}
            {customChains.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs text-zinc-500 border-t border-zinc-800 mt-1 pt-2">Custom</div>
                {customChains.map((chain) => {
                  const config = allConfigs[chain.id]
                  if (!config) return null
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
                  )
                })}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Language toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocale(locale === "en" ? "zh" : "en")}
        className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5"
      >
        <Languages className="h-4 w-4" />
        <span className="text-xs">{locale === "en" ? "中" : "EN"}</span>
      </Button>

      {/* Right: Wallet */}
      <Button
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={disconnect}
        className={
          connected
            ? "border-zinc-700 text-white hover:bg-zinc-800 gap-2"
            : "gap-2"
        }
      >
        <Wallet className="h-4 w-4" />
        {connected && address ? truncateAddress(address) : t("header.connectWallet")}
      </Button>
    </header>
  )
}
