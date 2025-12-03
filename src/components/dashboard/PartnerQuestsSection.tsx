"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check } from "lucide-react";

interface PartnerQuest {
  partner: string;
  logo: string;
  title: string;
  description: string;
  points: number;
  url: string;
  completed: boolean;
}

const partnerQuests: PartnerQuest[] = [
  {
    partner: "Uniswap",
    logo: "🦄",
    title: "Swap on Uniswap",
    description: "Execute 1 swap using Fast RPC",
    points: 10,
    url: "https://app.uniswap.org",
    completed: false,
  },
  {
    partner: "Aave",
    logo: "👻",
    title: "Supply on Aave",
    description: "Supply any asset to Aave via Fast RPC",
    points: 15,
    url: "https://app.aave.com",
    completed: false,
  },
  {
    partner: "Morpho",
    logo: "🦋",
    title: "Lend on Morpho",
    description: "Make a deposit on Morpho using Fast RPC",
    points: 15,
    url: "https://app.morpho.org",
    completed: false,
  },
  {
    partner: "OpenSea",
    logo: "🌊",
    title: "Trade on OpenSea",
    description: "Buy or sell an NFT via Fast RPC",
    points: 10,
    url: "https://opensea.io",
    completed: false,
  },
];

export const PartnerQuestsSection = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Partner Quests</h2>
        <p className="text-muted-foreground text-sm">
          Complete tasks with our protocol partners to earn bonus points
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {partnerQuests.map((quest) => (
          <Card
            key={quest.partner}
            className={`p-5 transition-all ${
              quest.completed
                ? "bg-success/5 border-success/30"
                : "bg-card/50 border-border/50 hover:border-primary/30"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{quest.logo}</div>
                  <div>
                    <h3 className="font-semibold">{quest.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quest.partner}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={quest.completed ? "default" : "outline"}
                  className={quest.completed ? "bg-success text-success-foreground" : ""}
                >
                  {quest.completed && <Check className="w-3 h-3 mr-1" />}
                  +{quest.points}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{quest.description}</p>

              {quest.completed ? (
                <Button disabled className="w-full" variant="outline">
                  <Check className="w-4 h-4 mr-2" />
                  Completed
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => window.open(quest.url, "_blank")}
                >
                  Go to {quest.partner}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

