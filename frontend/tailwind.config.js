/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
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
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
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
        gold: {
          DEFAULT: "hsl(var(--gold))",
          dim: "hsla(var(--gold), 0.7)",
          light: "hsla(var(--gold), 0.15)",
          border: "hsla(var(--gold), 0.35)",
          focus: "hsla(var(--gold), 0.5)",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          mid: "hsla(var(--ink), 0.6)",
          mute: "hsla(var(--ink), 0.38)",
        },
        parchment: "hsl(var(--parchment))",
        cream: "hsl(var(--cream))",
        success: {
          DEFAULT: "hsl(var(--success))",
          bg: "hsla(var(--success), 0.07)",
          border: "hsla(var(--success), 0.22)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          bg: "hsla(var(--warning), 0.07)",
          border: "hsla(var(--warning), 0.22)",
        },
        safe: "hsl(var(--success))", // Alias for success
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        luxury: "0 4px 40px rgba(160, 120, 40, 0.10), 0 1px 6px rgba(160, 120, 40, 0.07)",
      },
      borderWidth: {
        1.5: "1.5px",
      },
    },
  },
  plugins: [],
}
