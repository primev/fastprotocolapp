"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Task {
  name: string;
  points: number;
  completed: boolean;
  action?: string;
}

interface OneTimeTasksSectionProps {
  tasks: Task[];
}

export const OneTimeTasksSection = ({ tasks }: OneTimeTasksSectionProps) => {
  return (
    <Card className="p-6 bg-card/50 border-border/50">
      <h3 className="text-xl font-semibold mb-4">One-Time Tasks</h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.name}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
              task.completed
                ? "bg-success/5 border-success/30"
                : "bg-secondary/30 border-border/50 hover:border-primary/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  task.completed ? "bg-success" : "bg-secondary"
                }`}
              >
                {task.completed && <Check className="w-4 h-4 text-success-foreground" />}
              </div>
              <span className={task.completed ? "text-foreground" : "text-muted-foreground"}>
                {task.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                +{task.points}
              </Badge>
              {!task.completed && task.action && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (task.action === "email") {
                      toast.success("Email submission coming soon!");
                    } else {
                      window.open(task.action, "_blank");
                    }
                  }}
                >
                  Complete
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};