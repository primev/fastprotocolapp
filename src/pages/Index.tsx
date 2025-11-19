import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Twitter } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import fastProtocolLogo from "@/assets/fast-protocol-logo.png";
import primevLogo from "@/assets/primev-logo.png";
import a16zLogo from "@/assets/a16z-logo.webp";
import bodhiLogo from "@/assets/bodhi-logo.webp";
import figmentLogo from "@/assets/figment-logo.webp";
import hashkeyLogo from "@/assets/hashkey-logo.svg";
import longhashLogo from "@/assets/longhash-logo.webp";

const socialLinks = [
  {
    name: "Discord",
    icon: MessageCircle,
    url: "https://discord.gg/fastprotocol",
  },
  {
    name: "Telegram",
    icon: Send,
    url: "https://t.me/fastprotocol",
  },
  {
    name: "Twitter",
    icon: Twitter,
    url: "https://twitter.com/fastprotocol",
  },
];

const Index = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      toast({
        title: "Success!",
        description: "You've been added to the waitlist",
      });
      setEmail("");
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src={fastProtocolLogo} 
              alt="Fast Protocol" 
              className="h-32 md:h-40 w-auto"
            />
          </div>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground">
            Lightning-fast transactions. Seamless cross-chain operations.
          </p>

          {/* Email Signup */}
          <div className="backdrop-blur-sm bg-card/60 border border-primary/20 rounded-2xl p-6 md:p-8 shadow-xl max-w-xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 bg-background/50 border-primary/30 focus:border-primary"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg"
                  disabled={isLoading}
                  className="h-12 px-8 whitespace-nowrap"
                >
                  {isLoading ? "Claiming..." : "Claim Fast Pass"}
                </Button>
              </div>
            </form>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Button
                  key={social.name}
                  variant="glass"
                  size="lg"
                  asChild
                >
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{social.name}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pb-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Built by</span>
          <img src={primevLogo} alt="Primev" className="h-6 opacity-80" />
          <span className="mx-2">•</span>
          <span>Backed by</span>
          <img src={a16zLogo} alt="a16z" className="h-6 opacity-60 hover:opacity-100 transition-opacity" />
          <img src={bodhiLogo} alt="Bodhi Ventures" className="h-4 opacity-60 hover:opacity-100 transition-opacity" />
          <img src={figmentLogo} alt="Figment" className="h-9 opacity-60 hover:opacity-100 transition-opacity" />
          <img src={hashkeyLogo} alt="HashKey" className="h-6 opacity-60 hover:opacity-100 transition-opacity" />
          <img src={longhashLogo} alt="LongHash Ventures" className="h-24 opacity-60 hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
};

export default Index;
