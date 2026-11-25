import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;

/**
 * The checks that don't lean on Chromium's newer CSS (anchor positioning)
 * or its timing, in the other two engines. In CI only: they're slow, and
 * rarely the first to find a problem.
 */
const OTHER_ENGINES = [
    {
        name: "firefox",
        testDir: "tests/gallery",
        use: devices["Desktop Firefox"],
        testMatch: /(no-js|a11y|console)\.spec\.ts/,
    },
    {
        name: "webkit",
        testDir: "tests/gallery",
        use: devices["Desktop Safari"],
        testMatch: /(no-js|a11y|console)\.spec\.ts/,
    },
];

export default defineConfig({
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    // Most of a run is waiting on pages, so locally a worker per core.
    workers: process.env.CI ? undefined : "100%",
    reporter: process.env.CI
        ? [["html", { open: "never" }], ["github"]]
        : "list",
    use: {
        baseURL: `http://localhost:${PORT}`,
        // Still frames by default; motion.spec.ts turns motion back on
        reducedMotion: "reduce",
    },
    webServer: {
        // --ignore-lock: keeps the server in the foreground, for Playwright to run and stop
        command: `deno run preview --port ${PORT} --ignore-lock`,
        url: `http://localhost:${PORT}/gallery/manifest.json`,
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        {
            name: "chromium",
            testDir: "tests/gallery",
            use: devices["Desktop Chrome"],
        },
        {
            name: "orrery",
            testDir: "tests/orrery",
            // The canvas baselines stay out of git: they're made locally, on a clean tree
            snapshotPathTemplate: ".baselines/orrery/{arg}{ext}",
            use: devices["Desktop Chrome"],
        },
        ...(process.env.CI ? OTHER_ENGINES : []),
    ],
});
