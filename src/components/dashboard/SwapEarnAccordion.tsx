"use client"

import Image from "next/image"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface DeFiProtocol {
  name: string
  swapUrl: string
  logo: string
}

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
    logo: "https://cryptologos.cc/logos/balancer-bal-logo.png",
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

export const SwapEarnAccordion = () => {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="swap-earn"
      id="defi-protocols"
      className="mb-6 bg-card/50 border border-border/50 rounded-lg overflow-hidden"
    >
      <AccordionItem value="swap-earn">
        <AccordionTrigger className="flex justify-between items-center px-6 py-4 no-underline hover:no-underline focus:no-underline">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold m-0">Swap & Earn</h3>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {TOP_DEFI_PROTOCOLS.map((protocol) => (
              <Card
                key={protocol.name}
                className="p-3 sm:p-4 lg:p-3 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
                onClick={() => {
                  if (protocol.swapUrl) {
                    window.open(protocol.swapUrl, "_blank", "noopener,noreferrer")
                  }
                }}
              >
                <div className="flex items-center gap-3 sm:gap-4 lg:gap-3">
                  <div className="relative w-8 h-8 sm:w-10 sm:h-10 lg:w-8 lg:h-8">
                    <Image
                      src={protocol.logo}
                      alt={protocol.name}
                      fill
                      className="object-contain rounded"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm sm:text-base lg:text-sm group-hover:text-primary transition-colors">
                        {protocol.name}
                      </h4>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
