"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/web3";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/app-layout";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <TooltipProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster richColors position="bottom-right" duration={2500} closeButton />
        </TooltipProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
