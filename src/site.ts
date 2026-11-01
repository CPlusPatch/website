/** Site-wide constants shared by layouts and pages. */
export const site = {
    /** Used as the page title suffix and og:site_name. */
    name: "CPlusPatch",
} as const;

/** Self-hosted Plausible. Only loaded in production builds, see analytics.astro. */
export const analytics = {
    domain: "cpluspatch.com",
    host: "https://logs.cpluspatch.com",
    /** The script variant that also tracks outbound link clicks. */
    script: "/js/script.outbound-links.js",
} as const;
