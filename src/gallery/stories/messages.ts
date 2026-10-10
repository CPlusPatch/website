import Attachment from "../../components/blocks/attachment/attachment.astro";
import type { DialogueNode } from "../../components/blocks/message/dialogue.ts";
import InteractiveMessage from "../../components/blocks/message/interactive-message.astro";
import Message from "../../components/blocks/message/message.astro";
import MessageBubble from "../../components/blocks/message/message-bubble.astro";
import MessageGroup from "../../components/blocks/message/message-group.astro";
import Button from "../../components/ui/button.astro";
import greg from "../../images/greg.jpg";
import { type StoryGroup, story, title } from "../story.ts";

const VARIANTS = ["solid", "tinted", "outline", "ghost"] as const;

const GREG = { author: "Greg Heffley", avatar: greg } as const;

/** Shared by two branches: a tree may reuse a node, as long as it never loops. */
const COME_OVER: DialogueNode = {
    messages: ["Awesome!!", "My dad says we can only play for an hour though."],
    options: [
        {
            label: "An hour is plenty",
            next: {
                messages: ["Cool, see you at four! Bring the cheese puffs."],
            },
        },
        {
            label: "Can we play at mine?",
            reply: "Can we play at my house instead?",
            next: {
                messages: ["Won't Rodrick take the controller again?"],
                options: [
                    {
                        label: "I'll lock the basement",
                        reply: "I'll lock the basement door. He'll never know.",
                        next: { messages: ["Deal! On my way."] },
                    },
                    { label: "Fine, yours it is" },
                ],
            },
        },
    ],
};

const DIALOGUE: DialogueNode = {
    messages: ["Hey Greg!", "Want to come over and play Twisted Wizard?"],
    options: [
        { label: "Sure, I'll come over", next: COME_OVER },
        {
            label: "Can't, I'm busy",
            next: {
                messages: ["Busy doing what?"],
                options: [
                    {
                        label: "Homework",
                        next: {
                            messages: [
                                "On a Saturday??",
                                "OK, but you'll miss the new level with the dragon.",
                            ],
                        },
                    },
                    {
                        label: "Nothing, actually",
                        reply: "Nothing, actually. Let's play.",
                        next: COME_OVER,
                    },
                ],
            },
        },
    ],
};

/** An icon action, as it would sit in the `footer` slot. */
const action = (icon: string, label: string) =>
    story(
        label,
        Button,
        {
            size: "icon-sm",
            variant: "ghost",
            tone: "neutral",
            lift: false,
            "aria-label": label,
        },
        { icon },
    );

/** Runs the page-wide actions in src/gallery/dialogue-actions.ts. */
const RODRICK: DialogueNode = {
    messages: ["What do you want, dweeb?"],
    options: [
        {
            label: "Play me your new song",
            reply: "Can you play me Löded Diper's new song?",
            next: {
                messages: [
                    "Finally, someone with taste.",
                    "Hold on to something.",
                ],
                action: "shake",
                options: [
                    {
                        label: "That was awesome",
                        next: { messages: ["Obviously."] },
                    },
                    {
                        label: "My ears are ringing",
                        next: { messages: ["That means it's working."] },
                    },
                ],
            },
        },
        {
            label: "Mom says turn it down",
            next: {
                messages: [
                    "Oh yeah?",
                    "Let's see you find the volume knob in the dark.",
                ],
                action: "lightsOut",
                options: [
                    {
                        label: "Turn the lights back on",
                        action: "lightsOn",
                        next: { messages: ["Whatever. Get out of my room."] },
                    },
                    { label: "Run upstairs", reply: "*runs upstairs*" },
                ],
            },
        },
    ],
};

export const messages: StoryGroup[] = [
    {
        id: "message",
        title: "Messages",
        category: "chat",
        source: "blocks/message/message.astro",
        description:
            "Start for the other side, end for the reader. The avatar sits level with the bubble, not the footer.",
        min: 24,
        stories: [
            story(
                "start",
                Message,
                { ...GREG, time: "09:41", datetime: "2026-10-09T09:41" },
                { slot: "<p>Did you finish the history project yet?</p>" },
            ),
            story(
                "end",
                Message,
                { align: "end", time: "09:42", datetime: "2026-10-09T09:42" },
                {
                    slot: "<p>Not even close. Rowley spilled juice on the poster.</p>",
                },
            ),
            story(
                "status",
                Message,
                { align: "end", status: "Read" },
                {
                    slot: '<p>Here\'s the <a href="#message">draft</a>, tell me what you think.</p>',
                },
            ),
            story(
                "ghost-actions",
                Message,
                {
                    author: "Rowley Jefferson",
                    avatar: true,
                    variant: "ghost",
                    time: "16:20",
                    datetime: "2026-10-09T16:20",
                },
                {
                    slot: "<p>New Zoo-Wee Mama strip is up on the class board! This one finally has a sidekick.</p><p>Greg says the ending is too predictable but I think it's the best one yet.</p>",
                    slots: {
                        footer: [
                            action("lucide:reply", "Reply"),
                            action("lucide:smile-plus", "Add reaction"),
                            action("lucide:ellipsis", "More actions"),
                        ],
                    },
                },
            ),
            story("typing", Message, { ...GREG, typing: true }),
            story(
                "error",
                Message,
                {
                    align: "end",
                    variant: "tinted",
                    tone: "destructive",
                    status: "Not delivered",
                },
                { slot: "<p>Can you send me your notes?</p>" },
            ),
            story(
                "attachment",
                Message,
                { ...GREG, time: "09:44" },
                {
                    slot: "<p>Found the old one, use this.</p>",
                    children: [
                        story(
                            "file",
                            Attachment,
                            {
                                title: "history-poster.pdf",
                                icon: "lucide:file-text",
                                style: "margin-top: var(--space-sm)",
                            },
                            { slot: "PDF · 2.4 MB" },
                        ),
                    ],
                },
            ),
            story(
                "long-word",
                Message,
                { align: "end" },
                {
                    slot: "<p>https://example.com/an/extremely/long/link/that/has/no/spaces/to/break/at/whatsoever</p>",
                },
            ),
        ],
    },
    {
        id: "message-bubble",
        title: "Message bubbles",
        category: "chat",
        source: "blocks/message/message-bubble.astro",
        description: "Ghost drops the frame and the 80% width cap.",
        min: 16,
        stories: VARIANTS.flatMap((variant) =>
            (["neutral", "primary"] as const).map((tone) =>
                story(
                    `${variant}-${tone}`,
                    MessageBubble,
                    { variant, tone },
                    { slot: `<p>${title(variant)} bubble, ${tone} tone.</p>` },
                ),
            ),
        ),
    },
    {
        id: "message-group",
        title: "Message groups",
        category: "chat",
        source: "blocks/message/message-group.astro",
        description:
            "The first message names the sender; the last carries the avatar (the first, for ghost messages).",
        min: 24,
        stories: [
            story(
                "start",
                MessageGroup,
                {},
                {
                    children: [
                        "Hey.",
                        "Are you coming to the Halloween party?",
                        "Mom says I can go if you go.",
                    ].map((text, i) =>
                        story(
                            `message-${i}`,
                            Message,
                            { ...GREG, time: "18:02" },
                            { slot: `<p>${text}</p>` },
                        ),
                    ),
                },
            ),
            story(
                "ghost",
                MessageGroup,
                {},
                {
                    children: [
                        "Who took the last juice box from the fridge?",
                        "It was labelled.",
                        "In marker.",
                    ].map((text, i) =>
                        story(
                            `message-${i}`,
                            Message,
                            {
                                author: "Rodrick Heffley",
                                avatar: true,
                                variant: "ghost",
                                time: "07:15",
                            },
                            { slot: `<p>${text}</p>` },
                        ),
                    ),
                },
            ),
            story(
                "end",
                MessageGroup,
                {},
                {
                    children: [
                        "Maybe.",
                        "Only if we skip the haunted house.",
                    ].map((text, i) =>
                        story(
                            `message-${i}`,
                            Message,
                            { align: "end" },
                            { slot: `<p>${text}</p>` },
                        ),
                    ),
                },
            ),
        ],
    },
    {
        id: "interactive-message",
        title: "Interactive messages",
        category: "chat",
        source: "blocks/message/interactive-message.astro",
        description:
            "Pick a reply to walk the dialogue tree. Without JS, only the opening shows. Rodrick's branches run page-wide actions.",
        min: 24,
        stories: [
            story("default", InteractiveMessage, {
                tree: DIALOGUE,
                author: "Rowley Jefferson",
            }),
            story("page-actions", InteractiveMessage, {
                tree: RODRICK,
                author: "Rodrick Heffley",
            }),
            story("capped-height", InteractiveMessage, {
                tree: DIALOGUE,
                author: "Greg Heffley",
                avatar: greg,
                style: "max-block-size: 18rem",
            }),
        ],
    },
];
