/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './index.html',
  ],
  theme: {
  	extend: {
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
			},
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '1.5rem',
				md: '2rem',
				lg: '2.5rem',
				xl: '3rem',
				'2xl': '3.5rem',
			},
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1400px',
				'xs': '475px', // Add for extra small mobile
			},
		},
		maxWidth: {
			'page-narrow': '680px',
			'page-wide': '1200px',
			'page-full': '1400px',
		},
		spacing: {
			'18': '4.5rem',
			'88': '22rem',
		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			}
  		},
  		animation: {
  			marquee: "marquee var(--duration) linear infinite",
  			"marquee-vertical": "marquee-vertical var(--duration) linear infinite",
  		},
  		keyframes: {
  			marquee: {
  				from: { transform: "translateX(0)" },
  				to: { transform: "translateX(calc(-100% - var(--gap)))" },
  			},
  			"marquee-vertical": {
  				from: { transform: "translateY(0)" },
  				to: { transform: "translateY(calc(-100% - var(--gap)))" },
  			},
  		},
  		borderWidth: {
  			'subtle': '1px', // For custom border-subtle
  		},
  		borderRadius: {
  			lg: "var(--radius)",
  			md: "calc(var(--radius) - 2px)",
  			sm: "calc(var(--radius) - 4px)",
  		},
		keyframes: {
			"accordion-down": {
				from: { height: 0 },
				to: { height: "var(--radix-accordion-content-height)" },
			},
			boxShadow: {
				apple: '0 4px 20px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.1)',
				"apple-hover": '0 8px 32px rgba(0, 122, 255, 0.15)'
			},
			"accordion-up": {
				from: { height: "var(--radix-accordion-content-height)" },
				to: { height: 0 },
			},
			shimmer: {
				"0%": { backgroundPosition: "200% 0" },
				"100%": { backgroundPosition: "-200% 0" },
			},
		},
		animation: {
			"accordion-down": "accordion-down 0.2s ease-out",
			"accordion-up": "accordion-up 0.2s ease-out",
			shimmer: "shimmer 2s infinite",
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

// Add custom utilities in postcss or via plugin if needed for touch-manipulation (CSS: touch-action: manipulation;)
