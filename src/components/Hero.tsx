import { Button } from "@/components/ui/button";
import heroCover from "@/assets/hero-cover.jpg";

interface HeroProps {
  onClaimPass: () => void;
}

export const Hero = ({ onClaimPass }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroCover} 
          alt="Fast Protocol Network" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-secondary" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Fast Protocol
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            The next generation protocol for lightning-fast transactions and seamless cross-chain operations
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              variant="hero" 
              size="lg"
              onClick={onClaimPass}
              className="text-lg px-8 py-6 w-full sm:w-auto"
            >
              Claim Fast Pass
            </Button>
            <Button 
              variant="glass" 
              size="lg"
              className="text-lg px-8 py-6 w-full sm:w-auto"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
    </section>
  );
};
