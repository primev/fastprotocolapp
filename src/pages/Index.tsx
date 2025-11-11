import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Twitter, Mail } from "lucide-react";
import heroCover from "@/assets/hero-cover.jpg";

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroCover} 
          alt="Fast Protocol Network" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-secondary" />
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8 text-center">
          {/* Logo/Title */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Fast Protocol
            </span>
          </h1>
          
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
    </div>
  );
};

export default Index;
