import { useState } from "react"

export interface UseSmartAccountDetectionProps {
  // No props needed - check is triggered manually
}

export interface UseSmartAccountDetectionReturn {
  isSmartAccountModalOpen: boolean
  smartAccountNotComplete: boolean
  setIsSmartAccountModalOpen: (open: boolean) => void
  setSmartAccountNotComplete: (value: boolean) => void
  markAsAcknowledged: () => void
  checkAndShowModal: () => boolean // Returns true if modal should be shown, false if already acknowledged
}

const STORAGE_KEY = "smart-account-notification-acknowledged"

/**
 * Check if user has acknowledged the smart account notification
 */
function hasAcknowledged(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) === "true"
}

/**
 * Mark the smart account notification as acknowledged
 */
function markAsAcknowledged(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, "true")
}

/**
 * Hook to show smart account notification when user clicks connect button
 */
export function useSmartAccountDetection({}: UseSmartAccountDetectionProps = {}): UseSmartAccountDetectionReturn {
  const [isSmartAccountModalOpen, setIsSmartAccountModalOpen] = useState(false)
  const [smartAccountNotComplete, setSmartAccountNotComplete] = useState(false)

  /**
   * Check if user has acknowledged and show modal if not
   * Returns true if modal should be shown, false if already acknowledged
   */
  const checkAndShowModal = (): boolean => {
    // Check if user has already acknowledged
    if (hasAcknowledged()) {
      return false // Already acknowledged, don't show modal
    }

    // Show modal if not acknowledged
    setIsSmartAccountModalOpen(true)
    return true // Modal will be shown
  }

  const handleMarkAsAcknowledged = () => {
    markAsAcknowledged()
    setIsSmartAccountModalOpen(false)
  }

  return {
    isSmartAccountModalOpen,
    smartAccountNotComplete,
    setIsSmartAccountModalOpen,
    setSmartAccountNotComplete,
    markAsAcknowledged: handleMarkAsAcknowledged,
    checkAndShowModal,
  }
}
