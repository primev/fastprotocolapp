"use client"

import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { useRPCTest } from "@/hooks/use-rpc-test"

interface RPCConfigurationProps {
  onSetupClick: () => void
  onTestClick: () => void
  showTitle?: boolean
  additionalContent?: React.ReactNode
}

export function RPCConfiguration({
  onSetupClick,
  onTestClick,
  showTitle = true,
  additionalContent,
}: RPCConfigurationProps) {
  const { chain } = useAccount()
  const rpcTest = useRPCTest()

  if (chain?.id !== 1) {
    return (
      <Card className="p-4 bg-destructive/10 border-destructive/30">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            You must switch to Ethereum to continue.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="text-left space-y-2">
          <h4 className="text-lg font-semibold">RPC Configuration</h4>
          <p className="text-sm text-muted-foreground">
            Set up and test your Fast Protocol RPC connection.
          </p>
        </div>
      )}
      <div className="grid sm:grid-cols-1 gap-4">
        <Button
          onClick={onSetupClick}
          size="lg"
          className="w-full h-auto py-3 flex flex-col items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 relative"
          variant="outline"
        >
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
            1
          </div>
          <span className="font-semibold text-sm">Setup RPC</span>
          <span className="text-xs text-muted-foreground">Configure your wallet</span>
        </Button>
        <Button
          onClick={onTestClick}
          size="lg"
          disabled={rpcTest.isTesting}
          className="w-full h-auto py-3 flex flex-col items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 disabled:opacity-50 relative"
          variant="outline"
        >
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
            2
          </div>
          <span className="font-semibold text-sm">
            {rpcTest.isTesting ? "Testing..." : "Test Connection"}
          </span>
          <span className="text-xs text-muted-foreground">Verify RPC setup</span>
        </Button>
      </div>
      {additionalContent}
    </div>
  )
}
