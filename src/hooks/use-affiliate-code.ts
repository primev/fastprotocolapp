import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { useSignMessage } from "wagmi"
import { Fuul, UserIdentifierType } from "@fuul/sdk"
import { toast } from "sonner"
import "@/lib/fuul"

interface UseAffiliateCodeReturn {
  affiliateCode: string | null
  referralLink: string
  isLoadingCode: boolean
  isGeneratingLink: boolean
  isCreatingCode: boolean
  isCheckingCode: boolean
  checkCodeAvailability: (code: string) => Promise<boolean>
  createAffiliateCode: (code: string) => Promise<boolean>
  updateAffiliateCode: (code: string) => Promise<boolean>
  refreshAffiliateCode: () => Promise<void>
  refreshReferralLink: () => Promise<void>
}

const CODE_REGEX = /^[a-zA-Z0-9-]+$/
const MAX_CODE_LENGTH = 30

function validateCode(code: string): { valid: boolean; error?: string } {
  if (!code.trim()) {
    return { valid: false, error: "Please enter a valid affiliate code" }
  }

  if (!CODE_REGEX.test(code.trim())) {
    return { valid: false, error: "Code can only contain letters, numbers, and dashes" }
  }

  if (code.trim().length > MAX_CODE_LENGTH) {
    return { valid: false, error: "Code must be 30 characters or less" }
  }

  return { valid: true }
}

function handleFuulError(error: any): string {
  if (error?.name === "ValidationError") {
    return "Invalid code format. Use only letters, numbers, and dashes."
  } else if (error?.name === "InvalidSignatureError") {
    return "Invalid signature. Please try again."
  } else if (error?.name === "AddressInUseError") {
    return 'You already have an affiliate code. Use "Update Code" instead.'
  } else if (error?.name === "CodeInUseError") {
    return "This code is already taken. Please choose another."
  } else if (error?.message?.includes("User rejected")) {
    return "" // User cancelled - don't show error
  }
  return "An unexpected error occurred. Please try again."
}

export function useAffiliateCode(): UseAffiliateCodeReturn {
  const { isConnected, address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null)
  const [referralLink, setReferralLink] = useState("")
  const [isLoadingCode, setIsLoadingCode] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [isCreatingCode, setIsCreatingCode] = useState(false)
  const [isCheckingCode, setIsCheckingCode] = useState(false)

  // Load existing affiliate code
  const loadAffiliateCode = useCallback(async () => {
    if (!address) {
      setAffiliateCode(null)
      return
    }

    setIsLoadingCode(true)
    try {
      // @ts-ignore - Fuul SDK type definitions may be incorrect
      const result = await Fuul.getAffiliateCode(address)
      // Handle both string and Affiliate object return types
      const code =
        typeof result === "string" ? result : (result as unknown as { code?: string })?.code || null
      setAffiliateCode(code)
    } catch (error) {
      console.error("Error loading affiliate code:", error)
      setAffiliateCode(null)
    } finally {
      setIsLoadingCode(false)
    }
  }, [address])

  // Generate referral link
  const generateReferralLink = useCallback(
    async (codeOverride?: string | null) => {
      if (!address) {
        setReferralLink("")
        return
      }

      setIsGeneratingLink(true)
      try {
        const baseURL = `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/referral`
        // Use codeOverride if provided, otherwise use current affiliateCode state
        const codeToUse = codeOverride !== undefined ? codeOverride : affiliateCode

        // If we have an affiliate code, construct the URL directly
        // The SDK's generateTrackingLink is designed for addresses, not codes
        if (codeToUse) {
          const trackingLinkUrl = `${baseURL}?af=${encodeURIComponent(codeToUse)}`
          setReferralLink(trackingLinkUrl)
        } else {
          // For addresses, use the SDK method (with proper type handling)
          // @ts-ignore - SDK types may be incorrect, but this works for addresses
          const trackingLinkUrl = await Fuul.generateTrackingLink(baseURL, address)
          setReferralLink(trackingLinkUrl)
        }
      } catch (error) {
        console.error("Error generating referral link:", error)
        // Fallback: construct URL manually if SDK fails
        const baseURL = `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/referral`
        const codeToUse = codeOverride !== undefined ? codeOverride : affiliateCode
        if (codeToUse) {
          setReferralLink(`${baseURL}?af=${encodeURIComponent(codeToUse)}`)
        } else if (address) {
          setReferralLink(`${baseURL}?af=${encodeURIComponent(address)}`)
        } else {
          setReferralLink("")
        }
      } finally {
        setIsGeneratingLink(false)
      }
    },
    [address, affiliateCode]
  )

  // Check if code is available
  const checkCodeAvailability = useCallback(async (code: string): Promise<boolean> => {
    const validation = validateCode(code)
    if (!validation.valid) {
      toast.error(validation.error)
      return false
    }

    setIsCheckingCode(true)
    try {
      const isFree = await Fuul.isAffiliateCodeFree(code.trim())
      return !isFree
    } catch (error: any) {
      console.error("Error checking code availability:", error)
      if (error?.response?.status === 404 || error?.message?.includes("404")) {
        console.warn("Code availability check endpoint not available, skipping check")
        return true // Assume available, let create/update handle validation
      }
      console.warn("Could not verify code availability, proceeding anyway")
      return true // Assume available, let create/update handle validation
    } finally {
      setIsCheckingCode(false)
    }
  }, [])

  // Create affiliate code
  const createAffiliateCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!address) {
        toast.error("Please connect your wallet")
        return false
      }

      const validation = validateCode(code)
      if (!validation.valid) {
        toast.error(validation.error)
        return false
      }

      // Check if code is available first
      const isFree = await checkCodeAvailability(code)
      if (!isFree) {
        toast.error("This code is already taken. Please choose another.")
        return false
      }

      setIsCreatingCode(true)
      try {
        // Create message to sign
        const message = `I confirm that I am creating the ${code.trim()} code`

        // Sign message
        const signature = await signMessageAsync({
          message,
          account: address as `0x${string}`,
        })

        // Create affiliate code
        await Fuul.createAffiliateCode({
          userIdentifier: address,
          identifierType: UserIdentifierType.EvmAddress,
          signature,
          code: code.trim(),
        })

        const newCode = code.trim()
        setAffiliateCode(newCode)

        const baseURL = `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/referral`
        const newReferralLink = `${baseURL}?af=${encodeURIComponent(newCode)}`
        setReferralLink(newReferralLink)

        toast.success("Affiliate code created successfully!")
        return true
      } catch (error: any) {
        console.error("Error creating affiliate code:", error)
        const errorMessage = handleFuulError(error)
        if (errorMessage) {
          toast.error(errorMessage)
        }
        return false
      } finally {
        setIsCreatingCode(false)
      }
    },
    [address, signMessageAsync, checkCodeAvailability, generateReferralLink]
  )

  // Update affiliate code
  const updateAffiliateCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!address) {
        toast.error("Please connect your wallet")
        return false
      }

      const validation = validateCode(code)
      if (!validation.valid) {
        toast.error(validation.error)
        return false
      }

      // Check if code is available first (unless it's the same as current code)
      if (code.trim() !== affiliateCode) {
        try {
          const isFree = await checkCodeAvailability(code)
          if (!isFree) {
            toast.error("This code is already taken. Please choose another.")
            return false
          }
        } catch (error) {
          // If availability check fails, continue anyway - update will catch CodeInUseError
          console.warn("Availability check failed, proceeding with update")
        }
      }

      setIsCreatingCode(true)
      try {
        // Create message to sign
        const message = `I confirm that I am updating my code to ${code.trim()}`

        // Sign message
        const signature = await signMessageAsync({
          message,
          account: address as `0x${string}`,
        })

        // Update affiliate code
        await Fuul.updateAffiliateCode({
          userIdentifier: address,
          identifierType: UserIdentifierType.EvmAddress,
          signature,
          code: code.trim(),
        })

        const newCode = code.trim()
        setAffiliateCode(newCode)

        const baseURL = `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/referral`
        const newReferralLink = `${baseURL}?af=${encodeURIComponent(newCode)}`
        setReferralLink(newReferralLink)

        toast.success("Affiliate code updated successfully!")
        return true
      } catch (error: any) {
        console.error("Error updating affiliate code:", error)
        const errorMessage = handleFuulError(error)
        if (errorMessage) {
          toast.error(errorMessage)
        }
        return false
      } finally {
        setIsCreatingCode(false)
      }
    },
    [address, affiliateCode, signMessageAsync, checkCodeAvailability, generateReferralLink]
  )

  // Refresh affiliate code
  const refreshAffiliateCode = useCallback(async () => {
    await loadAffiliateCode()
  }, [loadAffiliateCode])

  // Refresh referral link
  const refreshReferralLink = useCallback(async () => {
    await generateReferralLink()
  }, [generateReferralLink])

  // Load affiliate code on mount and when address changes
  useEffect(() => {
    loadAffiliateCode()
  }, [loadAffiliateCode])

  // Generate referral link when address or affiliate code changes
  useEffect(() => {
    if (!isLoadingCode) {
      generateReferralLink()
    }
  }, [generateReferralLink, isLoadingCode])

  return {
    affiliateCode,
    referralLink,
    isLoadingCode,
    isGeneratingLink,
    isCreatingCode,
    isCheckingCode,
    checkCodeAvailability,
    createAffiliateCode,
    updateAffiliateCode,
    refreshAffiliateCode,
    refreshReferralLink,
  }
}
