
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PointsHUDProps {
  season: string;
  points: number;
  rank: number;
  referrals: number;
  volume: number;
  hasGenesisSBT: boolean;
  hasFastRPC: boolean;
}

export const PointsHUD = ({
  season,
  points,
  rank,
  referrals,
  volume,
  hasGenesisSBT,
  hasFastRPC,
}: PointsHUDProps) => {
  const statItems = [
    { label: "Season", value: season },
    { label: "Fast Points", value: points.toLocaleString(), mono: true },
    { label: "Rank", value: `#${rank.toLocaleString()}`, mono: true },
    { label: "Successful Referrals", value: referrals.toLocaleString(), mono: true },
    { label: "Fast RPC Volume", value: `$${volume.toLocaleString()}`, mono: true },
  ];

  const statusItems = [
    { label: "Genesis SBT", completed: hasGenesisSBT },
    { label: "Fast RPC", completed: hasFastRPC },
  ];

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4 mb-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {statItems.map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-semibold ${item.mono ? "font-mono" : ""}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
        {statusItems.map((item) => (
          <Badge
            key={item.label}
            variant={item.completed ? "default" : "outline"}
            className={item.completed ? "bg-success text-success-foreground" : ""}
          >
            {item.completed && <Check className="w-3 h-3 mr-1" />}
            {item.label}
          </Badge>
        ))}
      </div>
    </div>
  );
};
