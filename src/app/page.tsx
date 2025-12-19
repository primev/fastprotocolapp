"use client"

import { useState, Fragment } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { captureEmailAction } from "@/actions/capture-email"
import { Check, MessageCircle, Send } from "lucide-react"
import { FaXTwitter } from "react-icons/fa6"
import { AnimatedBackground } from "@/components/AnimatedBackground"
import type { CaptureEmailResult } from "@/lib/email"
import { useAddFastToMetamask } from "@/hooks/use-add-fast-to-metamask"
import Marquee from "react-fast-marquee"

const socialLinks = [
  {
    name: "Discord",
    icon: MessageCircle,
    url: "https://discord.gg/fastprotocol",
  },
  { name: "Telegram", icon: Send, url: "https://t.me/Fast_Protocol" },
  { name: "Twitter", icon: FaXTwitter, url: "https://x.com/Fast_Protocol" },
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

const IndexPage = () => {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [rpcAdded, setRpcAdded] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const { isProcessing, addFastToMetamask } = useAddFastToMetamask()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email?.includes("@")) {
      toast.error("Invalid email", {
        description: "Please enter a valid email address",
      })
      return
    }

    setIsLoading(true)
    try {
      const result: CaptureEmailResult = await captureEmailAction({ email })
      toast.success(result.alreadySubscribed ? "You're already subscribed!" : "Success!", {
        description: result.alreadySubscribed ? undefined : "You've been added to the waitlist",
      })
      if (!result.alreadySubscribed) {
        setIsSuccess(true)
        setTimeout(() => {
          setEmail("")
          setIsSuccess(false)
        }, 2000)
      }
    } catch (err) {
      console.error("Failed to capture email", err)
      toast.error("Something went wrong", {
        description: "We could not add your email right now. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRPC = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const success = await addFastToMetamask()
    if (success) {
      setRpcAdded(true)
      setTimeout(() => setRpcAdded(false), 3000)
    }
  }

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-background">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-20 w-full border-b border-primary/20 backdrop-blur-sm bg-background/60 sticky top-0 p-3">
        <div className="flex items-center justify-end">
          <Button
            variant="glass"
            size="sm"
            onClick={() =>
              window.open(
                "https://paragraph.com/@0xfa0b0f5d298d28efe4d35641724141ef19c05684/introducing-fast-protocol-a-coordinated-rewards-layer",
                "_blank"
              )
            }
          >
            Learn More
          </Button>
        </div>
      </header>

      <div className="relative z-10 w-full px-4 flex-1 flex flex-col justify-between py-4 sm:py-6 tablet:py-8 lg:py-6">
        <div className="max-w-6xl mx-auto w-full text-center flex-1 flex flex-col justify-between space-y-4">
          {/* Logo */}
          <section className="flex-1 flex items-center justify-center">
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={512}
              height={512}
              priority
              className="h-32 xs:h-40 sm:h-48 tablet:h-72 lg:h-56 xl:h-60 w-auto"
            />
          </section>

          {/* Tagline, Email & Social */}
          <section className="flex-1 flex flex-col justify-center space-y-3 xs:space-y-4 sm:space-y-5 tablet:space-y-8 lg:space-y-6">
            <div className="text-sm xs:text-base sm:text-lg tablet:text-2xl lg:text-base xl:text-xl text-muted-foreground px-3 xs:px-4 sm:px-6 tablet:px-8 lg:px-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span>Lightning-fast transactions on L1.</span>
              <span>Tokenized mev rewards.</span>
            </div>

            <div className="backdrop-blur-sm bg-card/60 border border-primary/20 rounded-xl sm:rounded-2xl p-2.5 xs:p-3 sm:p-3.5 tablet:p-6 lg:p-3.5 shadow-xl w-full max-w-xs xs:max-w-sm sm:max-w-md tablet:max-w-xl lg:max-w-xl xl:max-w-3xl mx-auto">
              <form
                onSubmit={handleSubmit}
                className="space-y-3 xs:space-y-4 tablet:space-y-5 lg:space-y-4"
              >
                <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 tablet:gap-4">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 text-sm xs:text-base sm:text-base tablet:text-lg lg:text-sm bg-background/50 border-primary/30 focus:border-primary"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    disabled={isLoading}
                    className="h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 px-6 xs:px-7 sm:px-8 tablet:px-10 lg:px-7 whitespace-nowrap text-sm xs:text-base sm:text-base tablet:text-lg lg:text-sm"
                  >
                    {isSuccess ? (
                      <Check className="w-5 h-5 xs:w-6 xs:h-6 tablet:w-7 tablet:h-7 lg:w-5 lg:h-5 text-green-500 animate-scale-in" />
                    ) : isLoading ? (
                      "Joining..."
                    ) : (
                      "Join Waitlist"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-2 xs:gap-3 tablet:gap-4 justify-center px-3 xs:px-4 tablet:px-6 mb-4 xs:mb-6 sm:mb-8 tablet:mb-0">
              {socialLinks.map(({ name, icon: Icon, url }) => (
                <Fragment key={name}>
                  <Button
                    variant="glass"
                    size="lg"
                    asChild
                    className="sm:hidden px-2.5 xs:px-3 tablet:px-4 py-2.5 xs:py-3 tablet:py-4 rounded-full aspect-square"
                  >
                    <a
                      href={url}
                      target={url.startsWith("mailto:") ? undefined : "_blank"}
                      rel={url.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      aria-label={name}
                    >
                      <Icon className="w-6 h-6 xs:w-7 xs:h-7 tablet:w-8 tablet:h-8" />
                    </a>
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    asChild
                    className="hidden tablet:flex text-lg lg:text-sm px-6 lg:px-4 py-3 lg:py-2"
                  >
                    <a
                      href={url}
                      target={url.startsWith("mailto:") ? undefined : "_blank"}
                      rel={url.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      aria-label={name}
                    >
                      <Icon className="w-5 h-5 lg:w-4 lg:h-4 mr-2" />
                      <span>{name}</span>
                    </a>
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    asChild
                    className="hidden sm:flex tablet:hidden text-sm px-4 py-2"
                  >
                    <a
                      href={url}
                      target={url.startsWith("mailto:") ? undefined : "_blank"}
                      rel={url.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      aria-label={name}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      <span>{name}</span>
                    </a>
                  </Button>
                </Fragment>
              ))}
            </div>
          </section>

          {/* Add RPC Button */}
          <section className="flex-1 flex items-center justify-center mt-4 xs:mt-6 sm:mt-8 tablet:mt-0">
            <div className="flex flex-col items-center space-y-2 xs:space-y-3 tablet:space-y-4 px-3 xs:px-4 tablet:px-6">
              <Button
                variant="glass"
                size="lg"
                onClick={handleAddRPC}
                disabled={isProcessing || rpcAdded}
                className="h-10 xs:h-11 sm:h-12 tablet:h-14 lg:h-11 px-6 xs:px-7 sm:px-8 tablet:px-10 lg:px-7 text-xs xs:text-sm sm:text-base tablet:text-lg lg:text-sm border-2 border-primary/20 flex items-center gap-2 tablet:gap-3 lg:gap-2"
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
              <button
                onClick={() => setIsHelpDialogOpen(true)}
                className="text-xs xs:text-sm sm:text-sm tablet:text-lg lg:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 underline underline-offset-4"
              >
                Need Help?
              </button>
            </div>
          </section>

          <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
            <DialogContent className="w-full h-full max-w-none max-h-none rounded-none translate-x-0 translate-y-0 left-0 top-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
              <DialogHeader>
                <DialogTitle>Adding Fast RPC to MetaMask</DialogTitle>
                <DialogDescription className="pt-4">
                  To properly add the Fast RPC network to MetaMask, you need to manually disconnect
                  all other wallet extensions first.
                </DialogDescription>
                <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                  <div className="space-y-2">
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
                </div>
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
