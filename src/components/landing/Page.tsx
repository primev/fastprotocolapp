"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { Button } from "@/components/ui/button"
import { useReadOnlyContractCall } from "@/hooks/use-read-only-contract-call"
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check } from "lucide-react"
import { SocialIcon } from "react-social-icons"
import { AnimatedBackground } from "@/components/AnimatedBackground"
import { useAddFastToMetamask } from "@/hooks/use-add-fast-to-metamask"
import Marquee from "react-fast-marquee"
import { DISCORD_INVITE_URL, TELEGRAM_INVITE_URL, TWITTER_INVITE_URL } from "@/lib/config/constants"

const socialLinks = [
  { name: "Discord", network: "discord", url: DISCORD_INVITE_URL },
  { name: "Telegram", network: "telegram", url: TELEGRAM_INVITE_URL },
  { name: "X", network: "x", url: TWITTER_INVITE_URL },
]

const footerLogos = [
  {
    src: "/assets/primev-logo.png",
    alt: "Primev",
    width: 100,
    height: 24,
    className: "h-6 tablet:h-8 w-auto opacity-80",
  },
  {
    src: "/assets/a16z-logo.webp",
    alt: "a16z",
    width: 177,
    height: 24,
    className: "h-6 tablet:h-8 w-auto opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/bodhi-logo.webp",
    alt: "Bodhi Ventures",
    width: 170,
    height: 16,
    className: "h-4 tablet:h-5 w-auto opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/figment-logo.webp",
    alt: "Figment",
    width: 96,
    height: 36,
    className: "h-9 tablet:h-12 w-auto opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/hashkey-logo.svg",
    alt: "HashKey",
    width: 73,
    height: 24,
    className: "h-6 tablet:h-8 w-auto opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/longhash-logo.png",
    alt: "LongHash Ventures",
    width: 96,
    height: 32,
    className: "h-8 tablet:h-10 w-auto opacity-60 hover:opacity-100 transition-opacity",
  },
]

interface IndexPageProps {
  onEarlyAccessClick?: () => void
  isCheckingAccess?: boolean
  hasAccess?: boolean
}

const IndexPage = ({
  onEarlyAccessClick,
  isCheckingAccess = false,
  hasAccess = false,
}: IndexPageProps) => {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()
  const [rpcAdded, setRpcAdded] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
  const { isProcessing, addFastToMetamask } = useAddFastToMetamask()
  const shouldNavigateAfterConnectRef = useRef(false)

  // Warm the server-side sheet caches on mount so gate/status is fast after wallet connect
  useEffect(() => {
    fetch("/api/gate/warm").catch(() => {})
  }, [])

  // Fetch waitlist count for social proof
  useEffect(() => {
    fetch("/api/waitlist/count")
      .then((r) => r.json())
      .then((data) => {
        if (data.count > 100) setWaitlistCount(data.count)
      })
      .catch(() => {})
  }, [])

  // Direct contract call to check if user has minted
  const { data: tokenId, isLoading: isLoadingTokenId } = useReadOnlyContractCall<bigint>({
    contractAddress: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getTokenIdByAddress",
    args: address ? [address] : [],
    enabled: isConnected && !!address,
  })

  const handleAddRPC = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const success = await addFastToMetamask()
    if (success) {
      setRpcAdded(true)
      setTimeout(() => setRpcAdded(false), 3000)
    }
  }

  const handleClaimClick = () => {
    if (!isConnected) {
      shouldNavigateAfterConnectRef.current = true
      openConnectModal()
    } else {
      // If already connected, check tokenId as proof of minting
      if (tokenId !== null && tokenId !== undefined && tokenId !== BigInt(0)) {
        router.push("/dashboard")
      } else {
        router.push("/claim/onboarding")
      }
    }
  }

  // Navigate after connection if user clicked claim
  // Wait for the contract call to fetch data using the address before navigating
  useEffect(() => {
    // Only proceed if:
    // 1. User is connected
    // 2. Address is available (passed to contract call)
    // 3. User clicked claim button
    // 4. Contract call has finished loading AND we have a definitive BigInt result
    //    (tokenId must be a BigInt - either BigInt(0) or a non-zero BigInt)
    //    We don't navigate if tokenId is null (means no data/error) or undefined
    if (
      isConnected &&
      address &&
      shouldNavigateAfterConnectRef.current &&
      !isLoadingTokenId &&
      tokenId !== null &&
      tokenId !== undefined &&
      typeof tokenId === "bigint" // Ensure we have an actual BigInt result
    ) {
      // Reset the flag before navigation
      shouldNavigateAfterConnectRef.current = false

      // Use tokenId as proof of minting - must be non-zero
      // tokenId is a BigInt: BigInt(0) means not minted, non-zero means minted
      if (tokenId !== BigInt(0)) {
        router.push("/dashboard")
      } else {
        router.push("/claim/onboarding")
      }
    }
  }, [isConnected, address, tokenId, isLoadingTokenId, router])

  return (
    <div className="relative h-dvh flex flex-col overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-10 w-full px-4 flex-1 flex flex-col justify-between py-4 sm:py-6 tablet:py-8 lg:py-6">
        <div className="max-w-6xl mx-auto w-full text-center flex-1 flex flex-col justify-between">
          {/* Launch App Button - Top Right */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <Button
              variant="glass"
              size="lg"
              asChild
              className="h-9 sm:h-10 px-4 sm:px-6 text-xs sm:text-sm"
            >
              <Link href="/dashboard">Launch App</Link>
            </Button>
          </div>

          {/* Logo */}
          <section className="flex-1 flex items-center justify-center pt-6 sm:pt-0">
            <h1 className="sr-only">
              Fast Protocol — Sub-second swaps on Ethereum with tokenized mev rewards
            </h1>
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={512}
              height={512}
              priority
              className="h-32 xs:h-40 sm:h-48 lg:h-56 xl:h-48 w-auto"
            />
          </section>

          {/* Tagline & CTA */}
          <section className="flex-1 flex flex-col justify-center space-y-3 xs:space-y-4 sm:space-y-5 tablet:space-y-8 lg:space-y-6">
            <h2 className="text-sm xs:text-base sm:text-lg tablet:text-xl lg:text-base xl:text-xl text-muted-foreground px-3 xs:px-4 sm:px-6 tablet:px-8 lg:px-6 font-normal">
              Get access to Fast Swap, with lightning-fast transactions on L1 and tokenized mev
              rewards.
            </h2>

            <div className="backdrop-blur-sm bg-card/60 border border-primary/20 rounded-xl sm:rounded-xl p-2.5 xs:p-3 sm:p-3.5 tablet:p-6 lg:p-3.5 shadow-xl w-full max-w-xs xs:max-w-sm sm:max-w-md tablet:max-w-xl lg:max-w-xl xl:max-w-3xl mx-auto">
              <Button
                variant="hero"
                size="lg"
                disabled={isCheckingAccess || isPending}
                onClick={() => {
                  setIsPending(true)
                  onEarlyAccessClick?.()
                  if (!isConnected) openConnectModal?.()
                  // pending resets if we stay on the page (e.g. connect modal opened)
                  setTimeout(() => setIsPending(false), 2000)
                }}
                className={`h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 px-6 xs:px-7 sm:px-8 tablet:px-10 lg:px-7 whitespace-nowrap text-sm xs:text-base sm:text-base tablet:text-lg lg:text-sm w-full hover:!scale-100 hover:!shadow-none`}
              >
                {isCheckingAccess || isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Checking access…
                  </span>
                ) : hasAccess ? (
                  "Access Granted"
                ) : (
                  "Get Early Access"
                )}
              </Button>
            </div>

            {waitlistCount && (
              <p className="text-xs xs:text-sm text-muted-foreground animate-in fade-in duration-700">
                {waitlistCount.toLocaleString()} wallets on the waitlist
              </p>
            )}

            {/* Add RPC & Claim SBT Badge Buttons */}
            <div className="flex flex-col items-center space-y-3 xs:space-y-3 tablet:space-y-4 px-3 xs:px-4 tablet:px-6 mb-4 xs:mb-6 sm:mb-8 tablet:mb-0">
              <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 tablet:gap-4 items-center">
                <Button
                  variant="glass"
                  size="lg"
                  onClick={handleAddRPC}
                  disabled={isProcessing || rpcAdded}
                  className="h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 px-6 xs:px-7 sm:px-8 tablet:px-10 lg:px-7 text-xs xs:text-sm sm:text-base tablet:text-lg lg:text-sm border-2 border-primary/20 flex items-center gap-2 tablet:gap-3 lg:gap-2 w-full sm:w-auto"
                >
                  {rpcAdded ? (
                    <>
                      <Check className="w-4 h-4 tablet:w-5 tablet:h-5 lg:w-4 lg:h-4" />
                      <span>Added Successfully!</span>
                    </>
                  ) : isProcessing ? (
                    "Processing..."
                  ) : (
                    <>
                      <Image
                        src="/assets/metamask-icon.svg"
                        alt="MetaMask"
                        width={24}
                        height={24}
                        className="w-4 h-4 tablet:w-5 tablet:h-5 lg:w-4 lg:h-4"
                      />
                      <span>Add Fast RPC</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="glass"
                  size="lg"
                  onClick={handleClaimClick}
                  className="h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 px-6 xs:px-7 sm:px-8 tablet:px-10 lg:px-7 text-xs xs:text-sm sm:text-base tablet:text-lg lg:text-sm border-2 border-primary/20 w-full sm:w-auto flex items-center gap-2 tablet:gap-3 lg:gap-2"
                >
                  <SocialIcon
                    network="opensea"
                    style={{
                      height: "22px",
                      width: "22px",
                    }}
                  />
                  Claim SBT Badge
                </Button>
              </div>
            </div>
          </section>

          {/* Social Links */}
          <section className="flex-1 flex items-center justify-center mt-4 xs:mt-6 sm:mt-8 tablet:mt-0">
            <div className="flex flex-col items-center space-y-3 xs:space-y-3 tablet:space-y-4 px-3 xs:px-4 tablet:px-6">
              <div className="flex flex-wrap gap-4 xs:gap-5 sm:gap-6 tablet:gap-7 justify-center">
                {socialLinks.map(({ name, network, url }) => (
                  <SocialIcon
                    key={name}
                    network={network}
                    url={url}
                    label={name}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      height: "40px",
                      width: "40px",
                    }}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHelpDialogOpen(true)}
                  className="text-xs xs:text-sm sm:text-sm tablet:text-lg lg:text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Help
                </button>
                <span className="text-xs xs:text-sm sm:text-sm tablet:text-lg lg:text-sm text-muted-foreground">
                  •
                </span>
                <Link
                  href="/learn"
                  className="text-xs xs:text-sm sm:text-sm tablet:text-lg lg:text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Learn
                </Link>
              </div>
            </div>
          </section>

          <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
            <DialogContent className="w-full h-full max-w-none max-h-none rounded-none translate-x-0 translate-y-0 left-0 top-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
              <DialogHeader>
                <DialogTitle>Adding Fast RPC to MetaMask</DialogTitle>
                <DialogDescription className="pt-4 space-y-3">
                  <p>
                    To properly add the Fast RPC network to MetaMask, you need to manually
                    disconnect all other wallet extensions first.
                  </p>
                  <div className="space-y-2 pt-2">
                    <p className="font-medium text-foreground">Steps to follow:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-left pl-2">
                      <li>
                        Open your browser extensions (click the puzzle icon in your browser toolbar)
                      </li>
                      <li>
                        Disconnect or disable any other wallet extensions (Rabby, Coinbase Wallet,
                        etc.)
                      </li>
                      <li>Make sure only MetaMask is active</li>
                      <li>Return to this page and click "Add Fast RPC"</li>
                    </ol>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    This is necessary because multiple wallet extensions can interfere with the
                    network addition process.
                  </p>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full py-3 sm:py-4 tablet:py-5 flex-shrink-0">
        <div className="lg:hidden overflow-hidden">
          <Marquee speed={50} gradient={false} pauseOnHover>
            <div className="flex items-center gap-4 tablet:gap-6 text-sm tablet:text-base lg:text-lg text-muted-foreground whitespace-nowrap mr-8 tablet:mr-12">
              <div className="flex items-center gap-2 tablet:gap-3">
                <span>Built by</span>
                <Image
                  src={footerLogos[0].src}
                  alt={footerLogos[0].alt}
                  width={footerLogos[0].width}
                  height={footerLogos[0].height}
                  className={footerLogos[0].className.replace("md:", "tablet:")}
                />
              </div>
              <span className="mx-2 tablet:mx-3">•</span>
              <span>Backed by</span>
              {footerLogos.slice(1).map((logo) => (
                <Image
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width}
                  height={logo.height}
                  className={logo.className.replace("md:", "tablet:")}
                />
              ))}
            </div>
          </Marquee>
        </div>

        <div className="hidden lg:flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground px-4">
          <div className="flex items-center gap-2">
            <span>Built by</span>
            <Image
              src={footerLogos[0].src}
              alt={footerLogos[0].alt}
              width={footerLogos[0].width}
              height={footerLogos[0].height}
              className="h-6 opacity-80"
            />
          </div>
          <span className="mx-2">•</span>
          <span>Backed by</span>
          {footerLogos.slice(1).map((logo) => (
            <Image
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className={logo.className
                .replace("tablet:h-8", "h-6")
                .replace("tablet:h-5", "h-4")
                .replace("tablet:h-12", "h-9")
                .replace("tablet:h-10", "h-8")}
            />
          ))}
        </div>
      </footer>
    </div>
  )
}

export default IndexPage
