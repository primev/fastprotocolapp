"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { ExternalLink, TrendingUp } from "lucide-react"
import Image from "next/image"

interface DeFiProtocol {
  name: string
  swapUrl: string
  logo: string
}

// Top DeFi swap protocols on Ethereum
const TOP_DEFI_PROTOCOLS: DeFiProtocol[] = [
  {
    name: "Uniswap",
    swapUrl: "https://app.uniswap.org/",
    logo: "https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png",
  },
  {
    name: "Curve",
    swapUrl: "https://curve.fi/",
    logo: "https://assets.coingecko.com/coins/images/12124/large/Curve.png",
  },
  {
    name: "Balancer",
    swapUrl: "https://balancer.fi/swap/ethereum/ETH",
    logo: "https://assets.coingecko.com/coins/images/11683/large/Balancer.png",
  },
  {
    name: "1inch",
    swapUrl: "https://app.1inch.io/",
    logo: "https://assets.coingecko.com/coins/images/13469/large/1inch-token.png",
  },
  {
    name: "SushiSwap",
    swapUrl: "https://www.sushi.com/swap",
    logo: "https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png",
  },
  {
    name: "KyberSwap",
    swapUrl: "https://kyberswap.com/swap",
    logo: "https://assets.coingecko.com/coins/images/14899/large/RwdVsGcw_400x400.jpg",
  },
]

export function DeFiProtocolsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const handleProtocolClick = (protocol: DeFiProtocol) => {
    if (protocol.swapUrl) {
      window.open(protocol.swapUrl, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl max-h-[80vh] overflow-y-auto border-primary/50"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Top DeFi Swap Protocols
          </DialogTitle>
          <DialogDescription>Click on any protocol to open their swap interface.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {TOP_DEFI_PROTOCOLS.map((protocol, index) => (
            <Card
              key={protocol.name}
              className="p-4 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
              onClick={() => handleProtocolClick(protocol)}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-background border border-border/50 flex-shrink-0">
                  <div className="relative w-10 h-10">
                    <Image
                      src={protocol.logo}
                      alt={protocol.name}
                      fill
                      className="object-contain rounded"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = "none"
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML =
                            '<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><svg class="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>'
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {protocol.name}
                      </h3>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
