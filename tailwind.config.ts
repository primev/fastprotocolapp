import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    screens: {
      // Content-based breakpoints (rem-based, DPR-safe)

      // Very narrow content
      xs: "20rem", // 320px

      // Narrow content
      sm: "30rem", // 480px

      // Compact content
      md: "40rem", // 640px

      // Tablet / small laptop
      tablet: "48rem", // 768px

      // Laptop / scaled MacBook desktop
      lg: "64rem", // 1024px

      // Primary desktop breakpoint (covers 1440×900 Retina Macs)
      xl: "80rem", // 1280px
    },

    container: {
      center: true,

      // Responsive padding to avoid cramped layouts on scaled displays
      padding: {
        DEFAULT: "1rem",
        lg: "1.5rem",
        xl: "2rem",
      },

      // Single max-width — avoids hard desktop cutoff
      screens: {
        xl: "80rem", // 1280px
      },
    },

    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },

      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-bottom-left": {
          "0%": {
            transform: "translateY(20px) translateX(-20px)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0) translateX(0)",
            opacity: "1",
          },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-bottom-left": "slide-in-bottom-left 0.3s ease-out",
      },
    },
  },

  plugins: [require("tailwindcss-animate")],
} satisfies Config;