"use client"

import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import type { Task, TaskName } from "@/hooks/use-dashboard-tasks"
import type { UserOnboardingData } from "@/hooks/use-user-onboarding"

interface OneTimeTasksAccordionProps {
  tasks: Task[]
  hasInitialized: boolean
  userOnboarding: UserOnboardingData | null
  isConnected: boolean
  address: string | undefined
  accordionValue: string | undefined
  onAccordionChange: (value: string | undefined) => void
  onTaskComplete: (taskName: TaskName) => Promise<void>
  onEmailTaskClick: () => void
}

export const OneTimeTasksAccordion = ({
  tasks,
  hasInitialized,
  userOnboarding,
  isConnected,
  address,
  accordionValue,
  onAccordionChange,
  onTaskComplete,
  onEmailTaskClick,
}: OneTimeTasksAccordionProps) => {
  return (
    <Accordion
      type="single"
      collapsible
      value={accordionValue}
      onValueChange={onAccordionChange}
      className="mb-6 bg-card/50 border border-border/50 rounded-lg overflow-hidden"
    >
      <AccordionItem value="one-time-tasks">
        <AccordionTrigger className="flex justify-between items-center px-6 py-4 no-underline hover:no-underline focus:no-underline">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold m-0">One-Time Tasks</h3>
            {hasInitialized && (
              <span className="text-sm text-muted-foreground">
                ({tasks.filter((task) => !task.completed).length} remaining)
              </span>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-6 pb-6">
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.name}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  task.completed
                    ? "bg-primary/5 border-primary/30"
                    : "bg-background/30 border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {task.completed ? (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted" />
                  )}
                  <span className={task.completed ? "text-foreground" : "text-muted-foreground"}>
                    {task.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {!task.completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (task.action === "email") {
                          // Check if wallet is connected
                          if (!isConnected || !address) {
                            toast.error("Please connect your wallet first")
                            return
                          }
                          onEmailTaskClick()
                        } else if (task.action) {
                          // Check if wallet is connected before opening external links
                          if (!isConnected || !address) {
                            toast.error("Please connect your wallet first")
                            return
                          }
                          window.open(task.action, "_blank")
                          // Auto-complete after opening link
                          setTimeout(() => onTaskComplete(task.name), 1000)
                        } else {
                          onTaskComplete(task.name)
                        }
                      }}
                    >
                      Complete
                      {task.action && <ExternalLink className="w-3 h-3 ml-2" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
