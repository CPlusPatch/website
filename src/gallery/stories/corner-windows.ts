import type { DialogueNode } from "../../components/blocks/message/dialogue.ts";
import InteractiveMessage from "../../components/blocks/message/interactive-message.astro";
import CornerWindow from "../../components/ui/corner-window.astro";
import greg from "../../images/greg.jpg";
import { type StoryGroup, story } from "../story.ts";

const SUPPORT: DialogueNode = {
    messages: ["Hi! I'm Greg.", "Need a hand with anything?"],
    options: [
        {
            label: "Who made this site?",
            next: {
                messages: [
                    "Jesse did. I just answer the questions.",
                    "Badly, according to Rodrick.",
                ],
            },
        },
        {
            label: "Just looking",
            reply: "Just looking around, thanks.",
            next: {
                messages: ["Cool. I'll be in this corner if you need me."],
            },
        },
    ],
};

const chat = story("chat", InteractiveMessage, {
    tree: SUPPORT,
    author: "Greg Heffley",
    avatar: greg,
});

export const cornerWindows: StoryGroup[] = [
    {
        id: "corner-window",
        title: "Corner windows",
        category: "primitives",
        source: "ui/corner-window.astro",
        description:
            "Pinned to the viewport's corner on a page; inline here. A popover on wide screens, a bottom sheet on narrow ones.",
        stories: [
            story(
                "message",
                CornerWindow,
                {
                    id: "story-corner-window-message",
                    label: "Chat with Greg",
                    inline: true,
                },
                { children: [chat] },
            ),
            story(
                "content",
                CornerWindow,
                {
                    id: "story-corner-window-content",
                    label: "Help",
                    icon: "lucide:circle-help",
                    variant: "outline",
                    tone: "neutral",
                    inline: true,
                },
                {
                    slot: "<p>Any content goes here: a note, some links or a short form.</p>",
                },
            ),
            story(
                "start",
                CornerWindow,
                {
                    id: "story-corner-window-start",
                    label: "Settings",
                    icon: "lucide:settings",
                    corner: "start",
                    tone: "secondary",
                    inline: true,
                },
                {
                    slot: "<p>Lines up with the button's start edge, for the bottom-left corner.</p>",
                },
            ),
        ],
    },
];
