import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, Check, Lock } from "lucide-react"

interface Milestone {
  threshold: number
  points: number
  completed: boolean
  locked?: boolean
}

interface WeeklyTasksSectionProps {
  transactions: number
  volume: number
}

export const WeeklyTasksSection = ({ transactions, volume }: WeeklyTasksSectionProps) => {
  const txMilestones: Milestone[] = [
    { threshold: 1, points: 1, completed: transactions >= 1 },
    { threshold: 10, points: 10, completed: transactions >= 10 },
    { threshold: 100, points: 100, completed: transactions >= 100 },
    { threshold: 1000, points: 500, completed: transactions >= 1000, locked: transactions < 100 },
  ]

  const volumeMilestones: Milestone[] = [
    { threshold: 100, points: 1, completed: volume >= 100 },
    { threshold: 1000, points: 10, completed: volume >= 1000 },
    { threshold: 10000, points: 100, completed: volume >= 10000 },
    { threshold: 100000, points: 1000, completed: volume >= 100000, locked: volume < 10000 },
  ]

  const renderMilestones = (milestones: Milestone[], prefix: string = "") => {
    return milestones.map((milestone, idx) => (
      <div
        key={idx}
        className={`flex items-center justify-between p-2 rounded-lg transition-all ${
          milestone.completed
            ? "bg-success/10 border border-success/30"
            : milestone.locked
              ? "bg-muted/30 border border-border/30 opacity-60"
              : "bg-secondary/30 border border-border/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              milestone.completed ? "bg-success" : milestone.locked ? "bg-muted" : "bg-secondary"
            }`}
          >
            {milestone.completed ? (
              <Check className="w-3 h-3 text-success-foreground" />
            ) : milestone.locked ? (
              <Lock className="w-3 h-3 text-muted-foreground" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            )}
          </div>
          <span className="text-sm">
            {prefix}
            {milestone.threshold.toLocaleString()} {prefix ? "" : "Transactions"}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          +{milestone.points}
        </Badge>
      </div>
    ))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Weekly Fast RPC Tasks</h2>
        <p className="text-muted-foreground text-sm">
          Complete milestones to earn points. Resets every Monday.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Transactions Card */}
        <Card className="p-6 bg-card/50 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Fast RPC Transactions</h3>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress to 100 txs</span>
                <span className="font-mono font-semibold">{transactions} / 100</span>
              </div>
              <Progress value={Math.min((transactions / 100) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-2 pt-2">{renderMilestones(txMilestones)}</div>
          </div>
        </Card>

        {/* Volume Card */}
        <Card className="p-6 bg-card/50 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Fast RPC Volume</h3>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress to $10,000</span>
                <span className="font-mono font-semibold">
                  ${volume.toLocaleString()} / $10,000
                </span>
              </div>
              <Progress value={Math.min((volume / 10000) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-2 pt-2">{renderMilestones(volumeMilestones, "$")}</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
