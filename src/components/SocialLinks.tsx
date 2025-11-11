import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Twitter } from "lucide-react";

const socialLinks = [
  {
    name: "Discord",
    icon: MessageCircle,
    url: "https://discord.gg/fastprotocol",
    color: "hover:text-[#5865F2]",
  },
  {
    name: "Telegram",
    icon: Send,
    url: "https://t.me/fastprotocol",
    color: "hover:text-[#0088cc]",
  },
  {
    name: "Twitter",
    icon: Twitter,
    url: "https://twitter.com/fastprotocol",
    color: "hover:text-[#1DA1F2]",
  },
];

export const SocialLinks = () => {
  return (
    <footer className="py-12 px-4 border-t border-border/50">
      <div className="container mx-auto">
        <div className="flex flex-col items-center space-y-6">
          <h3 className="text-xl font-semibold">Join Our Community</h3>
          
          <div className="flex gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Button
                  key={social.name}
                  variant="glass"
                  size="lg"
                  asChild
                  className={`transition-colors ${social.color}`}
                >
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="sr-only sm:not-sr-only sm:ml-2">{social.name}</span>
                  </a>
                </Button>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground">
            © 2024 Fast Protocol. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
