// @ts-check

/* import vue from "@astrojs/vue"; */
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

export default defineConfig({
    // Alpha deployment. Used for canonical and og:url links.
    site: "https://test.cpluspatch.com",
    // Until the content pages exist, the site is a UI toolkit showcase.
    redirects: {
        "/": "/gallery/",
    },
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
        // Ocean theme only (src/styles/themes/ocean.css). Not preloaded, so
        // the files are only fetched once text is drawn with them.
        {
            provider: fontProviders.fontsource(),
            name: "Nunito",
            cssVariable: "--font-nunito",
            styles: ["normal"],
            weights: ["200 900"],
            display: "swap",
            subsets: ["latin", "latin-ext"],
            fallbacks: ["sans-serif", "system-ui"],
        },
        {
            provider: fontProviders.fontsource(),
            name: "Fira Code",
            cssVariable: "--font-fira-code",
            styles: ["normal"],
            weights: ["300 700"],
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
