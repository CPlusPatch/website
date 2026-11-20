/**
 * The desktop page's own content (src/pages/desktop.astro). The rest comes
 * from data/home.ts, which it shares with the front page.
 */

/** A project's viewer window id, from its title: "Versia Protocol" is `p-versia-protocol`. */
export const projectId = (title: string): string =>
    `p-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;

/**
 * The top-level apps, in the page's order. The launcher and the desk icons
 * list them. The windows in src/pages/desktop.astro keep their own title and
 * icon: tests/gallery/desktop.spec.ts checks the two agree.
 */
export const apps = [
    { id: "w-readme", title: "README", icon: "lucide:file-text" },
    { id: "w-terminal", title: "Terminal", icon: "lucide:terminal" },
    { id: "w-projects", title: "Projects", icon: "lucide:folder" },
    { id: "w-monitor", title: "Monitor", icon: "lucide:activity" },
    { id: "w-letters", title: "Letters", icon: "lucide:mail" },
    { id: "w-radio", title: "Radio", icon: "lucide:music" },
    { id: "w-chat", title: "Chat", icon: "lucide:message-circle" },
    { id: "w-toys", title: "Toys", icon: "lucide:joystick" },
] as const;
