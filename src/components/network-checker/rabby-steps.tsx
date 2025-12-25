"use client"

import { useState } from "react"
import { Copy, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FAST_PROTOCOL_NETWORK } from "@/lib/network-config"

export function RabbySteps() {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const networkDetails = [
    { label: "Network Name", value: FAST_PROTOCOL_NETWORK.chainName, field: "name" },
    { label: "RPC URL", value: FAST_PROTOCOL_NETWORK.rpcUrls[0], field: "rpc" },
    { label: "Chain ID", value: FAST_PROTOCOL_NETWORK.chainId.toString(), field: "chainId" },
    {
      label: "Currency Symbol",
      value: FAST_PROTOCOL_NETWORK.nativeCurrency.symbol,
      field: "symbol",
    },
    {
      label: "Block Explorer",
      value: FAST_PROTOCOL_NETWORK.blockExplorerUrls[0],
      field: "explorer",
    },
  ]

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
            1
          </div>
          <div className="w-0.5 h-full min-h-8 bg-border mt-2"></div>
        </div>
        <div className="flex-1 space-y-2 pt-3 border-t border-border">
          <h3 className="font-semibold text-sm mb-2">Network Details</h3>
          {networkDetails.map((detail) => (
            <div
              key={detail.field}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{detail.label}</p>
                <p className="text-xs font-mono break-all">{detail.value}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-7 w-7 p-0"
                onClick={() => copyToClipboard(detail.value, detail.field)}
              >
                {copiedField === detail.field ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
            2
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="pt-3 border-t border-border">
            <div className="relative flex gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Important: Switch to the network after adding
                </p>
                <p className="text-sm text-muted-foreground">
                  This step is completed automatically when adding a custom network. Follow the
                  video instructions to setup the RPC connection.
                </p>
              </div>
            </div>
          </div>

          {/* Video Media Window */}
          <div className="space-y-2 pt-3 border-t border-border">
            <h3 className="font-semibold text-sm mb-2">Video Instructions</h3>
            <div className="w-full rounded-lg overflow-hidden">
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 0,
                  paddingBottom: "149.722%",
                }}
              >
                <iframe
                  allow="fullscreen"
                  allowFullScreen
                  height="100%"
                  src="https://streamable.com/e/cvw2ce?muted=1"
                  width="100%"
                  style={{
                    border: "none",
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    overflow: "hidden",
                  }}
                  title="Rabby Setup Instructions"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
