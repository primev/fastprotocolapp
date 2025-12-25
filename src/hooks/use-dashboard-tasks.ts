import { useMemo } from "react"
import { toast } from "sonner"
import type { UserOnboardingData } from "./use-user-onboarding"
import { DISCORD_INVITE_URL, TELEGRAM_INVITE_URL } from "@/lib/constants"

export type TaskName =
  | "Connect Wallet"
  | "Fast RPC Setup"
  | "Mint Genesis SBT"
  | "Follow @fast_protocol"
  | "Join Discord"
  | "Join Telegram"
  | "Enter Email"

type TaskConfig = {
  fieldName: keyof UserOnboardingData
  requiresWallet: boolean
  requiresConnection: boolean
  requiresSBT?: boolean
}

const TASK_CONFIG: Record<TaskName, TaskConfig> = {
  "Connect Wallet": {
    fieldName: "connect_wallet_completed",
    requiresWallet: true,
    requiresConnection: true,
  },
  "Fast RPC Setup": {
    fieldName: "setup_rpc_completed",
    requiresWallet: true,
    requiresConnection: false,
  },
  "Mint Genesis SBT": {
    fieldName: "mint_sbt_completed",
    requiresWallet: true,
    requiresConnection: false,
    requiresSBT: true,
  },
  "Follow @fast_protocol": {
    fieldName: "x_completed",
    requiresWallet: true,
    requiresConnection: false,
  },
  "Join Discord": {
    fieldName: "discord_completed",
    requiresWallet: true,
    requiresConnection: false,
  },
  "Join Telegram": {
    fieldName: "telegram_completed",
    requiresWallet: true,
    requiresConnection: false,
  },
  "Enter Email": {
    fieldName: "email_completed",
    requiresWallet: true,
    requiresConnection: false,
  },
}

export type Task = {
  name: TaskName
  completed: boolean
  points?: number
  action?: string
}

export interface UseDashboardTasksReturn {
  oneTimeTasks: Task[]
  getTaskCompleted: (taskName: TaskName) => boolean
  handleTaskComplete: (taskName: TaskName) => Promise<void>
}

export interface UseDashboardTasksProps {
  userOnboarding: UserOnboardingData | null
  hasGenesisSBT: boolean
  isConnected: boolean
  address: string | undefined
  updateUserOnboarding: (updates: Record<string, boolean>) => Promise<boolean>
  onMintComplete?: () => void
}

/**
 * Hook to manage dashboard tasks (validation, completion, status)
 */
export function useDashboardTasks({
  userOnboarding,
  hasGenesisSBT,
  isConnected,
  address,
  updateUserOnboarding,
  onMintComplete,
}: UseDashboardTasksProps): UseDashboardTasksReturn {
  // Validate task completion prerequisites
  const validateTaskCompletion = (taskName: TaskName): { valid: boolean; error?: string } => {
    const config = TASK_CONFIG[taskName]

    if (!config) {
      return { valid: false, error: "Unknown task" }
    }

    // Check wallet connection requirements - all wallet-requiring tasks need both isConnected and address
    if (config.requiresWallet && (!isConnected || !address)) {
      return { valid: false, error: "Please connect your wallet first" }
    }

    // Check active connection requirement (for tasks that specifically need active connection)
    if (config.requiresConnection && (!isConnected || !address)) {
      return { valid: false, error: "Please connect your wallet first" }
    }

    // Check SBT requirement
    if (config.requiresSBT && !hasGenesisSBT) {
      return { valid: false, error: "Please mint your Genesis SBT first" }
    }

    return { valid: true }
  }

  // Handle task completion with proper error handling
  const handleTaskComplete = async (taskName: TaskName) => {
    // Special handling for Mint Genesis SBT - verify it's actually minted before updating DB
    if (taskName === "Mint Genesis SBT") {
      // Verify SBT is actually minted on-chain
      if (!hasGenesisSBT) {
        toast.error(
          'Please mint your Genesis SBT first. You can mint it by clicking "Mint Genesis SBT" button.'
        )
        return
      }
    }

    // Validate prerequisites
    const validation = validateTaskCompletion(taskName)
    if (!validation.valid) {
      toast.error(validation.error || "Task cannot be completed")
      return
    }

    const config = TASK_CONFIG[taskName]
    if (!config || !address) {
      toast.error("Invalid task configuration")
      return
    }

    try {
      const success = await updateUserOnboarding({
        [config.fieldName]: true,
      })

      if (success) {
        // Task completed successfully - UI will update via getTaskCompleted
        // Handle special cases
        if (taskName === "Mint Genesis SBT") {
          localStorage.setItem("hasGenesisSBT", "true")
          toast.success("Genesis SBT minted! Points and Leaderboard unlocked!")
          onMintComplete?.()
        } else {
          toast.success(`${taskName} completed!`)
        }
      } else {
        toast.error("Failed to save task completion")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete task"
      toast.error(errorMessage)
    }
  }

  // Determine task completion status from user onboarding data
  const getTaskCompleted = (taskName: TaskName): boolean => {
    if (!userOnboarding) {
      return false
    }

    const config = TASK_CONFIG[taskName]
    if (!config) return false

    return userOnboarding[config.fieldName] || false
  }

  const oneTimeTasks = useMemo(
    () => [
      {
        name: "Connect Wallet" as TaskName,
        completed: getTaskCompleted("Connect Wallet"),
      },
      {
        name: "Fast RPC Setup" as TaskName,
        completed: getTaskCompleted("Fast RPC Setup"),
      },
      {
        name: "Mint Genesis SBT" as TaskName,
        completed: getTaskCompleted("Mint Genesis SBT"),
      },
      {
        name: "Follow @fast_protocol" as TaskName,
        points: 1,
        completed: getTaskCompleted("Follow @fast_protocol"),
        action: "https://x.com/fast_protocol",
      },
      {
        name: "Join Discord" as TaskName,
        completed: getTaskCompleted("Join Discord"),
        action: DISCORD_INVITE_URL,
      },
      {
        name: "Join Telegram" as TaskName,
        completed: getTaskCompleted("Join Telegram"),
        action: TELEGRAM_INVITE_URL,
      },
      {
        name: "Enter Email" as TaskName,
        completed: getTaskCompleted("Enter Email"),
        action: "email",
      },
    ],
    [userOnboarding, hasGenesisSBT]
  )

  return {
    oneTimeTasks,
    getTaskCompleted,
    handleTaskComplete,
  }
}
