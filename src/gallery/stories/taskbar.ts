import { type IconName, iconSvg } from "@cpluspatch/ui";
import DeskIcons from "@cpluspatch/ui/astro/blocks/desk-icons.astro";
import Launcher from "@cpluspatch/ui/astro/blocks/launcher.astro";
import Taskbar from "@cpluspatch/ui/astro/blocks/taskbar.astro";
import Button from "@cpluspatch/ui/astro/ui/button.astro";
import { type StoryGroup, story } from "../story.ts";

const items = [
    { href: "#story-readme", label: "README", icon: "lucide:file-text" },
    { href: "#story-terminal", label: "Terminal", icon: "lucide:terminal" },
    { href: "#story-projects", label: "Projects", icon: "lucide:folder" },
    { href: "#story-monitor", label: "Monitor", icon: "lucide:activity" },
];

/** A window button as the window manager makes it, in the state a story shows. */
const item = (icon: IconName, title: string, state?: "active" | "minimised") =>
    `<li><button type="button" class="taskbar__item${
        state === "minimised" ? " taskbar__item--minimised" : ""
    }"${state === "active" ? ' aria-current="true"' : ""}>${iconSvg(icon, {
        class: "taskbar__icon",
    })}<span class="taskbar__label">${title}</span>${
        state === "minimised"
            ? '<span class="taskbar__state"> (minimised)</span>'
            : ""
    }</button></li>`;

export const taskbar: StoryGroup[] = [
    {
        id: "taskbar",
        title: "Taskbar",
        category: "primitives",
        description:
            "A launcher, a button for each open window and a tray. The window manager fills the list; here it's written out. The top window's button has a rule under it, and a minimised one is italic and quieter.",
        min: "full",
        stories: [
            story(
                "windows",
                Taskbar,
                {
                    id: "story-taskbar-windows",
                    class: "taskbar--on",
                    // The preview centres its story, which would size the bar to its buttons.
                    style: "inline-size: 100%",
                },
                {
                    slot: [
                        item("file", "README", "active"),
                        item("message-circle", "Chat"),
                        item(
                            "bookmark",
                            "A window with a rather long title",
                            "minimised",
                        ),
                    ].join(""),
                    slots: {
                        start: [
                            story("launcher", Launcher, {
                                id: "story-taskbar-launcher",
                                items,
                            }),
                        ],
                        tray: [
                            story(
                                "clock",
                                Button,
                                { variant: "ghost", tone: "neutral" },
                                { slot: "12:04" },
                            ),
                        ],
                    },
                },
            ),
        ],
    },
    {
        id: "launcher",
        title: "Launcher",
        category: "primitives",
        description:
            "A button that opens a menu of links above it. A native popover: Esc and an outside click close it, and so does choosing a link.",
        stories: [
            story("closed", Launcher, { id: "story-launcher-closed", items }),
        ],
    },
    {
        id: "desk-icons",
        title: "Desk icons",
        category: "primitives",
        description:
            "A column of links, each an icon on a tile above its label. On a window manager's desk it sits at the right edge, under the windows.",
        stories: [story("default", DeskIcons, { items })],
    },
];
