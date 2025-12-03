'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Check,
  Twitter,
  Wallet,
  Network,
  Zap,
  ChevronRight,
  Home,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
};

const OnboardingPage = () => {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'twitter',
      title: 'Connect X',
      description: 'Connect your X (Twitter) account',
      icon: Twitter,
      completed: false,
    },
    {
      id: 'follow',
      title: 'Follow Us on X',
      description: 'Follow @fast_protocol to continue',
      icon: Twitter,
      completed: false,
    },
    {
      id: 'wallet',
      title: 'Connect Wallet',
      description: 'Connect your wallet to mint your SBT',
      icon: Wallet,
      completed: false,
    },
    {
      id: 'rpc',
      title: 'Fast RPC Setup',
      description: 'Configure Fast RPC for your first Fast transaction',
      icon: Network,
      completed: false,
    },
  ]);

  const [showRpcInfo, setShowRpcInfo] = useState(false);

  const handleStepAction = (stepId: string) => {
    if (stepId === 'twitter') {
      // Simulate Twitter connection
      toast.success('X account connected successfully!');
      setTimeout(() => {
        updateStepStatus(stepId, true);
      }, 1000);
    } else if (stepId === 'follow') {
      // Open follow link
      window.open(
        'https://twitter.com/intent/follow?screen_name=fast_protocol',
        '_blank'
      );
      toast.success('Please follow @fast_protocol to continue');
      setTimeout(() => {
        updateStepStatus(stepId, true);
      }, 2000);
    } else if (stepId === 'wallet') {
      // Simulate wallet connection
      toast.success('Wallet connected successfully!');
      updateStepStatus(stepId, true);
    } else if (stepId === 'rpc') {
      setShowRpcInfo(true);
    }
  };

  const handleAddRpc = () => {
    // Simulate RPC addition
    toast.success('Fast RPC added to your wallet!');
    updateStepStatus('rpc', true);
    setShowRpcInfo(false);
  };

  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, completed } : step))
    );
  };

  const allStepsCompleted = steps.every((step) => step.completed);

  const handleMintSbt = () => {
    // Map onboarding steps to Dashboard task names
    const completedTasks = [
      'Connect X',
      'Follow @fast_protocol',
      'Connect Wallet',
      'Fast RPC Setup',
      'Mint Genesis SBT',
    ];

    // Save completed tasks to localStorage
    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
    localStorage.setItem('hasGenesisSBT', 'true');

    toast.success('Genesis SBT minted successfully!');
    setTimeout(() => {
      router.push('/dashboard?tab=genesis');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/claim')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Zap className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold gradient-text">
                FAST Protocol
              </span>
            </button>
            <Button
              variant="outline"
              onClick={() => router.push('/claim')}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Return to Home
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold">
                Setup Your Account
              </h1>
              <p className="text-muted-foreground text-lg">
                Complete these steps to mint your Genesis SBT
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card
                    key={step.id}
                    className={`p-6 transition-all duration-300 ${
                      step.completed
                        ? 'bg-primary/5 border-primary/50'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          step.completed
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Step {index + 1}
                            </span>
                          </div>
                          <h3 className="text-xl font-semibold">
                            {step.title}
                          </h3>
                          <p className="text-muted-foreground">
                            {step.description}
                          </p>
                        </div>

                        {step.id === 'rpc' &&
                          showRpcInfo &&
                          !step.completed && (
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 space-y-4 border border-primary/30">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <Zap className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-lg mb-1">
                                    Fast RPC Setup
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Add Fast Protocol network to your wallet
                                  </p>
                                </div>
                              </div>

                              <p className="text-sm leading-relaxed">
                                Your Genesis SBT will be minted{' '}
                                <span className="text-primary font-semibold">
                                  through
                                </span>{' '}
                                Fast RPC — this is your first Fast Protocol
                                transaction.
                              </p>

                              <p className="text-sm text-muted-foreground leading-relaxed">
                                Fast RPC routes your transactions through a
                                private, cryptoeconomic commitment network that
                                offers millisecond preconfirmations instead of
                                dumping your transactions into the public
                                mempool.
                              </p>

                              <div className="bg-card/50 rounded-lg p-4 space-y-4 border border-border/50">
                                <div className="flex items-center gap-2 text-primary">
                                  <Globe className="w-4 h-4" />
                                  <span className="font-semibold">
                                    Network Details
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Network Name
                                    </div>
                                    <div className="font-semibold">
                                      Fast Protocol Mainnet
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Chain ID
                                    </div>
                                    <div className="font-semibold">42170</div>
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    RPC URL
                                  </div>
                                  <div className="font-mono text-sm text-primary">
                                    https://rpc.fast.protocol
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Currency Symbol
                                    </div>
                                    <div className="font-semibold">FAST</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Block Explorer
                                    </div>
                                    <div className="font-mono text-sm text-primary truncate">
                                      https://explorer.fast.pro...
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3 pt-2">
                                <Button
                                  onClick={handleAddRpc}
                                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                  <Zap className="w-4 h-4 mr-2" />
                                  Add to Wallet
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setShowRpcInfo(false)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                        {!step.completed && (
                          <Button
                            onClick={() => handleStepAction(step.id)}
                            variant={
                              step.id === 'rpc' && !showRpcInfo
                                ? 'default'
                                : 'outline'
                            }
                            className={
                              step.id === 'rpc' && !showRpcInfo
                                ? 'bg-primary hover:bg-primary/90'
                                : ''
                            }
                          >
                            {step.id === 'twitter' && 'Connect X Account'}
                            {step.id === 'follow' && 'Follow @fast_protocol'}
                            {step.id === 'wallet' && 'Connect Wallet'}
                            {step.id === 'rpc' &&
                              !showRpcInfo &&
                              'Setup Fast RPC'}
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Mint Button */}
            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">Ready to Mint</h3>
                <p className="text-muted-foreground">
                  Complete all steps above to mint your Fast Genesis SBT
                </p>
                <Button
                  size="lg"
                  disabled={!allStepsCompleted}
                  onClick={handleMintSbt}
                  className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed glow-border"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Mint Genesis SBT
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OnboardingPage;
