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
    build: {
        // Every page's CSS goes in its <style>, so the first paint waits on
        // the HTML alone rather than on stylesheet requests too. Measured with
        // Lighthouse: ~150 ms sooner on the big pages (home, gallery, desktop),
        // ~150 ms later on the small ones, whose HTML no longer fits in the
        // first round trip; keeping head.css a file and inlining the rest was
        // slower on both.
        inlineStylesheets: "always",
    },
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
        // Soft style only (packages/ui/src/styles/styles/soft.css). Not preloaded, so
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
        // Print style only (packages/ui/src/styles/styles/print.css), not preloaded
        {
            provider: fontProviders.fontsource(),
            name: "Source Serif 4",
            cssVariable: "--font-source-serif",
            styles: ["normal", "italic"],
            weights: ["200 900"],
            display: "swap",
            subsets: ["latin", "latin-ext"],
            fallbacks: ["serif"],
        },
        // Display face for page and section titles (--font-display)
        {
            provider: fontProviders.fontsource(),
            name: "Big Shoulders Display",
            cssVariable: "--font-big-shoulders",
            styles: ["normal"],
            // Only --weight-display (800) is drawn in it: a single static
            // file is a fraction of the size of the variable one.
            weights: ["800"],
            display: "swap",
            subsets: ["latin"],
            fallbacks: ["sans-serif"],
        },
        // The orbit viewer only (src/pages/orbits.astro)
        {
            provider: fontProviders.fontsource(),
            name: "IBM Plex Sans Condensed",
            cssVariable: "--font-plex-sans-condensed",
            styles: ["normal"],
            weights: ["400", "500", "600", "700"],
            display: "swap",
            subsets: ["latin", "latin-ext"],
            fallbacks: ["Arial Narrow", "sans-serif"],
        },
        {
            provider: fontProviders.fontsource(),
            name: "IBM Plex Mono",
            cssVariable: "--font-plex-mono",
            styles: ["normal"],
            weights: ["400", "500"],
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
        // Imported only from client scripts, so the dev server finds them
        // when a page first loads them. That re-bundles the deps under a new
        // hash, and modules still asking for the old one get an empty 504,
        // which drops their styles and breaks the page until a reload.
        optimizeDeps: {
            include: [
                "uwuifier",
                "matter-js",
                "three",
                "three/addons/controls/OrbitControls.js",
                "three/addons/lines/Line2.js",
                "three/addons/lines/LineMaterial.js",
                "three/addons/lines/LineGeometry.js",
                "three/addons/renderers/CSS2DRenderer.js",
                "@gouvfr/dsfr/dist/core/core.module.min.js",
                "@gouvfr/dsfr/dist/component/button/button.module.min.js",
                "@gouvfr/dsfr/dist/component/checkbox/checkbox.module.min.js",
                "@gouvfr/dsfr/dist/component/modal/modal.module.min.js",
                "@gouvfr/dsfr/dist/component/header/header.module.min.js",
            ],
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
