// @ts-check

/* import vue from "@astrojs/vue"; */
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

export default defineConfig({
    integrations: [/* vue() */ icon()],
    fonts: [
        {
            provider: fontProviders.fontsource(),
            name: "Inter",
            cssVariable: "--font-inter",
            styles: ["normal"],
            weights: ["100 900"],
            display: "swap",
            subsets: ["latin", "latin-ext"],
            fallbacks: ["sans-serif", "system-ui"],
        },
        {
            provider: fontProviders.fontsource(),
            name: "JetBrains Mono",
            cssVariable: "--font-jetbrains-mono",
            styles: ["normal"],
            weights: ["400", "700"],
            display: "swap",
            subsets: ["latin", "latin-ext"],
            fallbacks: ["monospace", "ui-monospace"],
        },
    ],
    vite: {
        css: {
            transformer: "lightningcss",
            lightningcss: {
                targets: browserslistToTargets(browserslist(">= 2%")),
            },
        },
    },
});
