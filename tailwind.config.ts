import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Theme clair et epure, inspire du site philipkarto.com (fond gris
        // chaud, cartes blanches, texte quasi noir, accent or fonce pour
        // rester lisible sur fond clair). "ink" reste le nom du fond
        // principal, "paper" celui du texte principal, meme si leurs
        // valeurs sont desormais inversees par rapport au theme sombre
        // d'origine.
        ink: "#f3f1ea",
        paper: "#221f19",
        bone: "#ffffff",
        gold: "#8a6a30",
        line: "#e2dccb",
        // Chip sombre dedie pour poser le logo blanc (variante claire du
        // logo pas fournie) dans la sidebar.
        brandDark: "#0a0a0a",
        // Nomme suite a l'audit UX : evite que des ors "en dur" (#c9a35c,
        // #c39d63) se multiplient a cote du token "gold".
        goldBright: "#c9a35c",
        success: "#2f9e63",
        danger: "#c43c2c",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Helvetica", "Arial", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};

export default config;
