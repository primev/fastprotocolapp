import { Hero } from "@/components/Hero";
import { EmailSignup } from "@/components/EmailSignup";
import { SocialLinks } from "@/components/SocialLinks";

const Index = () => {
  const handleClaimPass = () => {
    // Scroll to email signup
    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Hero onClaimPass={handleClaimPass} />
      <EmailSignup />
      <SocialLinks />
    </div>
  );
};

export default Index;
