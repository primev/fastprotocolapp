'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, ChevronRight } from 'lucide-react';
import { SocialIcon } from 'react-social-icons';
import { NFT_NAME, NFT_DESCRIPTION } from '@/lib/contract-config';
import { OPENSEA_URL } from '@/lib/constants';

const SBT_VIDEO_ASSET = '/assets/SBT-token-animated.mp4';

interface SBTDisplayCardProps {
  hasGenesisSBT: boolean;
  tokenId: bigint | undefined;
  address: string | undefined;
  isMounted: boolean;
}

export const SBTDisplayCard = ({
  hasGenesisSBT,
  tokenId,
  address,
  isMounted,
}: SBTDisplayCardProps) => {
  const router = useRouter();
  const isMinted = hasGenesisSBT && tokenId !== undefined;
  const hasNotMinted = address && !isMinted;

  return (
    <CardContainer containerClassName="py-0">
      <CardBody className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4 h-auto w-full max-w-md group/card dark:hover:shadow-2xl dark:hover:shadow-primary/[0.1]">
        <div className="space-y-3 pb-0">
          {/* Header */}
          <CardItem translateZ={30} className="w-full">
            <div className="flex items-center justify-between h-7">
              <div className="text-lg font-bold">Genesis SBT</div>

              <div className="h-7 flex items-center">
                {isMinted ? (
                  <div className="flex items-center gap-2 h-7">
                    <Badge className="bg-primary text-primary-foreground h-7 flex items-center px-3">
                      <Check className="w-3 h-3 mr-1" />#{String(tokenId)}
                    </Badge>
                    <div
                      onClick={() => window.open(OPENSEA_URL, '_blank')}
                      className="cursor-pointer hover:opacity-80 transition-opacity h-7 w-7 flex items-center justify-center"
                    >
                      <SocialIcon
                        network="opensea"
                        style={{ height: 28, width: 28 }}
                      />
                    </div>
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/50 h-7 flex items-center"
                  >
                    Not Minted
                  </Badge>
                )}
              </div>
            </div>
          </CardItem>

          {/* SBT Visual */}
          <CardItem translateZ={80} className="w-3/4 mx-auto">
            <div className="relative w-full aspect-[5/7]">
              <video
                src={SBT_VIDEO_ASSET}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-contain rounded-lg group-hover/card:shadow-xl"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const placeholder = target.nextElementSibling as HTMLElement;
                  if (placeholder) placeholder.classList.remove('hidden');
                }}
              />
              {/* Fallback placeholder if video fails to load */}
              <div className="w-full h-full flex items-center justify-center hidden absolute inset-0">
                <div className="text-center space-y-2">
                  <Zap className="w-16 h-16 mx-auto text-primary-foreground" />
                  <div className="text-primary-foreground font-bold text-lg">
                    FAST
                  </div>
                  <div className="text-primary-foreground/80 text-xs">
                    Genesis
                  </div>
                </div>
              </div>
              {hasNotMinted && (
                <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none rounded-lg">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push('/claim/onboarding');
                    }}
                    className="bg-background/90 hover:bg-background border-primary/50 hover:border-primary hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group pointer-events-auto lg:text-sm lg:h-10 lg:px-6"
                  >
                    Mint Genesis SBT
                    <ChevronRight className="w-4 h-4 lg:w-3.5 lg:h-3.5 ml-2 lg:ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>
                </div>
              )}
            </div>
          </CardItem>

          {/* Description */}
          <CardItem translateZ={20} className="w-full">
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                {NFT_DESCRIPTION}
              </p>
            </div>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
};
