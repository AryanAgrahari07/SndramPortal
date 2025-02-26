/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      animation: {
        // Toast animations
        "toast-in-right": "toast-in-right 0.3s ease-in-out",
        "toast-in-bottom": "toast-in-bottom 0.3s ease-in-out",
        "toast-out": "toast-out 0.3s ease-in-out forwards",
        "toast-swipe": "toast-swipe 0.2s ease-out forwards",
        // Existing animations
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-in-out",
        "collapsible-up": "collapsible-up 0.2s ease-in-out",
      },
      keyframes: {
        // Enhanced toast keyframes
        "toast-in-right": {
          "0%": {
            transform: "translateX(100%)",
            opacity: 0,
          },
          "100%": {
            transform: "translateX(0)",
            opacity: 1,
          },
        },
        "toast-in-bottom": {
          "0%": {
            transform: "translateY(100%)",
            opacity: 0,
          },
          "100%": {
            transform: "translateY(0)",
            opacity: 1,
          },
        },
        "toast-out": {
          "0%": {
            transform: "translateX(0)",
            opacity: 1,
          },
          "100%": {
            transform: "translateX(100%)",
            opacity: 0,
          },
        },
        "toast-swipe": {
          "0%": {
            transform: "translateX(var(--radix-toast-swipe-move-x))",
          },
          "100%": {
            transform: "translateX(calc(100% + 1rem))",
          },
        },
        // Existing keyframes
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};