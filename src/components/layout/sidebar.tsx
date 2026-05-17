"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileCode,
  Search,
  Hexagon,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUiStore } from "@/stores/ui-store"
import { useLocaleStore } from "@/stores/locale-store"
import { cn } from "@/lib/utils"

const navItems = [
  { labelKey: "nav.contract", icon: FileCode, href: "/" },
  { labelKey: "nav.analyzer", icon: Search, href: "/analyzer" },
  { labelKey: "nav.calldata", icon: Hexagon, href: "/calldata-builder" },
  { labelKey: "nav.history", icon: History, href: "/history" },
  { labelKey: "nav.settings", icon: Settings, href: "/settings" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUiStore()
  const { t } = useLocaleStore()

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 shrink-0",
        sidebarOpen ? "w-[240px]" : "w-16"
      )}
    >
      {/* Logo area */}
      <div className="flex items-center h-14 px-3 border-b border-zinc-800">
        {sidebarOpen && (
          <span className="text-white font-semibold text-sm truncate">
            Web3 Contract Tool
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0",
            sidebarOpen ? "ml-auto" : "mx-auto"
          )}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            const label = t(item.labelKey)

            if (!sidebarOpen) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger className="w-full">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
