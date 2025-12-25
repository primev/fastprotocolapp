"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card"
import { Badge } from "@/components/ui/badge"
import { Check, ChevronRight } from "lucide-react"
import { SocialIcon } from "react-social-icons"
import { NFT_NAME, NFT_DESCRIPTION } from "@/lib/contract-config"
import { OPENSEA_URL } from "@/lib/constants"

const SBT_VIDEO_ASSET = "/assets/SBT-token-animated.mp4"

interface SBTDisplayCardProps {
  hasGenesisSBT: boolean
  tokenId: bigint | undefined
  address: string | undefined
  isMounted: boolean
}

export const SBTDisplayCard = ({
  hasGenesisSBT,
  tokenId,
  address,
  isMounted,
}: SBTDisplayCardProps) => {
  const router = useRouter()
  const isMinted = hasGenesisSBT && tokenId !== undefined
  const hasNotMinted = address && !isMinted

  return (
    <CardContainer containerClassName="py-0">
      <CardBody className="relative overflow-hidden border border-primary/30 rounded-xl h-auto w-full max-w-md group/card dark:hover:shadow-2xl dark:hover:shadow-primary/[0.1] aspect-[3/4]">
        {/* Video Background */}
        <video
          src={SBT_VIDEO_ASSET}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = "none"
          }}
        />

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background/90" />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full p-4">
          {/* Header */}
          <CardItem translateZ={30} className="w-full">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-foreground drop-shadow-md">Genesis SBT</div>

              <div className="flex items-center gap-2">
                {isMinted ? (
                  <>
                    <Badge className="bg-primary text-primary-foreground h-7 flex items-center px-3">
                      <Check className="w-3 h-3 mr-1" />#{String(tokenId)}
                    </Badge>
                    <div
                      onClick={() => window.open(OPENSEA_URL, "_blank")}
                      className="cursor-pointer hover:opacity-80 transition-opacity h-7 w-7 flex items-center justify-center"
                    >
                      <SocialIcon network="opensea" style={{ height: 28, width: 28 }} />
                    </div>
                  </>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/50 h-7 flex items-center bg-background/50 backdrop-blur-sm"
                  >
                    Not Minted
                  </Badge>
                )}
              </div>
            </div>
          </CardItem>

          {/* Spacer - pushes content to top and bottom */}
          <div className="flex-1 flex items-center justify-center">
            {hasNotMinted && (
              <CardItem translateZ={60}>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push("/claim/onboarding")
                  }}
                  className="bg-background/90 hover:bg-background border-primary/50 hover:border-primary hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group lg:text-sm lg:h-10 lg:px-6"
                >
                  Mint Genesis SBT
                  <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 ml-2 lg:ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </CardItem>
            )}
          </div>

          {/* Description */}
          <CardItem translateZ={20} className="w-full">
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center drop-shadow-sm">
                {NFT_DESCRIPTION}
              </p>
            </div>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  )
}
