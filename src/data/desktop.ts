/**
 * The desktop page's own content (src/pages/desktop.astro). The rest comes
 * from data/home.ts, which it shares with the front page.
 */

/** A project's viewer window id, from its title: "Versia Server" is `p-versia-server`. */
export const projectId = (title: string): string =>
    `p-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;
