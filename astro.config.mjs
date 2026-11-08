// @ts-check

import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

export default defineConfig({
    // Used for canonical and og:url links.
    site: "https://cpluspatch.com",
    // src/icons must exist, or the dev server stops watching src/. See its README.
    integrations: [icon()],
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
        // Ocean theme only (packages/ui/src/styles/themes/ocean.css). Not preloaded, so
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
        // Display face for page and section titles (--font-display)
        {
            provider: fontProviders.fontsource(),
            name: "Big Shoulders Display",
            cssVariable: "--font-big-shoulders",
            styles: ["normal"],
            weights: ["700 900"],
            display: "swap",
            subsets: ["latin"],
            fallbacks: ["sans-serif"],
        },
    ],
    vite: {
        css: {
            transformer: "lightningcss",
            lightningcss: {
                targets: browserslistToTargets(browserslist(">= 2%")),
            },
        },
        server: {
            watch: {
                // gallery:diff checks out and builds a whole second copy of
                // the site in there; none of it is this one's source.
                ignored: ["**/.gallery-diff/**"],
            },
        },
    },
});
