import Window from "@cpluspatch/ui/astro/ui/window.astro";
import { type StoryGroup, story } from "../story.ts";

export const windows: StoryGroup[] = [
    {
        id: "window",
        title: "Windows",
        category: "primitives",
        description:
            "One app's window: a plain titled section, or framed like a window manager shows it.",
        min: 24,
        stories: [
            story(
                "plain",
                Window,
                {
                    id: "story-window-plain",
                    title: "README",
                    icon: "lucide:file-text",
                    path: "~/README.md",
                },
                {
                    slot: "<p>Hi, I'm Jesse. I write software, mostly for the web.</p><p>This is the plain view, a section under its title bar.</p>",
                },
            ),
            story(
                "framed",
                Window,
                {
                    id: "story-window-framed",
                    title: "README",
                    icon: "lucide:file-text",
                    path: "~/README.md",
                    framed: true,
                },
                {
                    slot: "<p>Hi, I'm Jesse. I write software, mostly for the web.</p><p>This is the framed view, with a border, a ruled bar and a shadow.</p>",
                },
            ),
            story(
                "long-title",
                Window,
                {
                    id: "story-window-long-title",
                    title: "A rather long window title that wraps",
                    icon: "lucide:folder",
                    path: "~/projects/a/deeply/nested/folder/with-a-long-name.md",
                    framed: true,
                },
                {
                    slot: "<p>The title and the path wrap at narrow widths instead of overflowing.</p>",
                },
            ),
            story(
                "scrolling",
                Window,
                {
                    id: "story-window-scrolling",
                    title: "Notes",
                    icon: "lucide:file-text",
                    path: "~/notes.md",
                    framed: true,
                    style: "block-size: 14rem",
                },
                {
                    slot: Array.from(
                        { length: 6 },
                        (_, i) =>
                            `<p>Paragraph ${i + 1}. The body scrolls inside the frame when it's taller than the window. Tab to it to see the focus ring, and scroll to see the fade at the bottom edge go.</p>`,
                    ).join(""),
                },
            ),
        ],
    },
];
