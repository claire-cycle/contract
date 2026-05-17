"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileCode,
  Search,
  Hexagon,
  Bell,
  Database,
  History,
  Settings,
  Star,
  ArrowRight,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHistoryStore } from "@/stores/history-store";
import { useRouter } from "next/navigation";
import { getChainConfig } from "@/lib/web3";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string[];
}

const navItems = [
  { labelKey: "nav.contract", icon: FileCode, href: "/" },
  { labelKey: "nav.analyzer", icon: Search, href: "/analyzer" },
  { labelKey: "nav.calldata", icon: Hexagon, href: "/calldata-builder" },
  { labelKey: "nav.events", icon: Bell, href: "/events" },
  { labelKey: "nav.storage", icon: Database, href: "/storage" },
  { labelKey: "nav.history", icon: History, href: "/history" },
  { labelKey: "nav.settings", icon: Settings, href: "/settings" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useLocaleStore();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const favorites = useFavoritesStore((s) => s.favorites);
  const transactions = useHistoryStore((s) => s.transactions);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // Navigation items
    for (const item of navItems) {
      list.push({
        id: `nav-${item.href}`,
        label: t(item.labelKey),
        icon: item.icon,
        action: () => {
          router.push(item.href);
          onClose();
        },
        keywords: [t(item.labelKey), item.href],
      });
    }

    // Favorites
    for (const fav of favorites.slice(0, 10)) {
      const chainConfig = getChainConfig(fav.chainId);
      list.push({
        id: `fav-${fav.id}`,
        label: fav.name || fav.address.slice(0, 10) + "...",
        sublabel: `${chainConfig?.name ?? `Chain ${fav.chainId}`} · ${fav.address.slice(0, 8)}...${fav.address.slice(-4)}`,
        icon: Star,
        action: () => {
          onClose();
        },
        keywords: [fav.address, fav.name ?? "", chainConfig?.name ?? ""],
      });
    }

    // Recent transactions
    for (const tx of transactions.slice(0, 5)) {
      const chainConfig = getChainConfig(tx.chainId);
      list.push({
        id: `tx-${tx.id}`,
        label: `${tx.method || "Transaction"} · ${tx.hash.slice(0, 10)}...`,
        sublabel: `${chainConfig?.name ?? `Chain ${tx.chainId}`} · ${tx.status}`,
        icon: History,
        action: () => {
          onClose();
        },
        keywords: [tx.hash, tx.method, tx.from, tx.to],
      });
    }

    return list;
  }, [t, router, onClose, favorites, transactions]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.sublabel?.toLowerCase().includes(lower) ||
        item.keywords.some((k) => k.toLowerCase().includes(lower)),
    );
  }, [items, query]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.action();
      setQuery("");
    },
    [],
  );

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800 p-0 gap-0">
        <DialogTitle className="sr-only">{t("command.placeholder")}</DialogTitle>
        <div className="flex items-center border-b border-zinc-800 px-3">
          <Search className="h-4 w-4 text-zinc-500 shrink-0 mr-2" />
          <Input
            placeholder={t("command.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                handleSelect(filtered[0]);
              }
            }}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-500 h-11"
          />
          <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] shrink-0 ml-2">
            ESC
          </Badge>
        </div>
        <ScrollArea className="max-h-[320px]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-sm">
              {t("command.noResults")}
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-zinc-500 text-xs truncate">{item.sublabel}</div>
                      )}
                    </div>
                    <ArrowRight className="h-3 w-3 text-zinc-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
