import Attachment from "@cpluspatch/ui/astro/blocks/attachment/attachment.astro";
import AttachmentGroup from "@cpluspatch/ui/astro/blocks/attachment/attachment-group.astro";
import Post from "@cpluspatch/ui/astro/blocks/post/post.astro";
import PostAction from "@cpluspatch/ui/astro/blocks/post/post-action.astro";
import PostActions from "@cpluspatch/ui/astro/blocks/post/post-actions.astro";
import PostContext from "@cpluspatch/ui/astro/blocks/post/post-context.astro";
import PostQuote from "@cpluspatch/ui/astro/blocks/post/post-quote.astro";
import PostStats from "@cpluspatch/ui/astro/blocks/post/post-stats.astro";
import PostThread from "@cpluspatch/ui/astro/blocks/post/post-thread.astro";
import Icon from "@cpluspatch/ui/astro/icon.astro";
import Image from "@cpluspatch/ui/astro/image.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { type Story, type StoryGroup, story } from "../story.ts";

const GREG = {
    author: "Greg Heffley",
    handle: "@greg@heffley.example",
    avatar: greg,
} as const;
const ROWLEY = {
    author: "Rowley Jefferson",
    handle: "@rowley@jefferson.example",
} as const;
const RODRICK = {
    author: "Rodrick Heffley",
    handle: "@rodrick@lodeddiper.example",
} as const;

type Variant = "boxed" | "feed";

/** The reply / boost / favourite / bookmark / share row. */
const actions = (
    n: { replies?: number; boosts?: number; favourites?: number } = {},
    on: { boosted?: boolean; favourited?: boolean; bookmarked?: boolean } = {},
    off: { boost?: boolean } = {},
): Story =>
    story(
        "actions",
        PostActions,
        {},
        {
            children: [
                story("reply", PostAction, {
                    icon: "lucide:message-circle",
                    label: "Reply",
                    count: n.replies,
                }),
                story("boost", PostAction, {
                    icon: "lucide:repeat-2",
                    label: "Boost",
                    count: n.boosts,
                    pressed: on.boosted ?? false,
                    disabled: off.boost ?? false,
                }),
                story("favourite", PostAction, {
                    icon: "lucide:heart",
                    label: "Favourite",
                    count: n.favourites,
                    pressed: on.favourited ?? false,
                    filled: true,
                }),
                story("bookmark", PostAction, {
                    icon: "lucide:bookmark",
                    label: "Bookmark",
                    pressed: on.bookmarked ?? false,
                    filled: true,
                    end: true,
                }),
                story("share", PostAction, {
                    icon: "lucide:share",
                    label: "Share",
                    end: true,
                }),
            ],
        },
    );

const boosted = (who: string) =>
    story(
        "boost-context",
        PostContext,
        { icon: "lucide:repeat-2" },
        { slot: `<a href="#">${who}</a> boosted` },
    );

const replying = (who: string) =>
    story(
        "reply-context",
        PostContext,
        { icon: "lucide:reply" },
        { slot: `Replying to <a href="#">${who}</a>` },
    );

const quoted = story(
    "quote",
    PostQuote,
    { ...ROWLEY, time: "3h", href: "#" },
    {
        slot: "Zoo-Wee Mama is the best graphic novel I have ever read and nobody can tell me otherwise.",
    },
);

const picture = story("picture", Image, {
    src: testPattern,
    alt: "A colour test pattern",
    width: 800,
    height: 450,
});

/** Several pictures in one post: they share a frame. */
const pictures = (n: number) =>
    Array.from({ length: n }, (_, i) =>
        story(`picture-${i + 1}`, Image, {
            src: i % 2 ? greg : testPattern,
            alt: `Picture ${i + 1} of ${n}`,
            width: 800,
            height: 450,
        }),
    );

/** Files and pictures as attachments, which frame themselves. */
const file = story(
    "file",
    Attachment,
    { title: "journal-rules.pdf", icon: "lucide:file-text", href: "#" },
    { slot: "PDF · 2.4 MB" },
);

const files = story(
    "files",
    AttachmentGroup,
    { label: "Attachments" },
    {
        children: [
            file,
            story(
                "photo",
                Attachment,
                { title: "greg.jpg", image: greg, href: "#" },
                { slot: "JPG · 184 KB" },
            ),
            story(
                "pattern",
                Attachment,
                { title: "test-pattern.jpg", image: testPattern, href: "#" },
                { slot: "JPG · 96 KB" },
            ),
        ],
    },
);

const visibility = story("visibility", Icon, {
    name: "lucide:lock",
    role: "img",
    "aria-label": "Followers only",
});

const text = (s: string) => `<p>${s}</p>`;

/** The same posts in both directions, so they can be compared. */
const posts = (variant: Variant): Story[] => [
    story(
        "default",
        Post,
        {
            ...GREG,
            variant,
            time: "2h",
            datetime: "2026-11-04T09:41",
            href: "#",
        },
        {
            slot: text(
                "Mom says I have to keep a <em>journal</em>, not a diary. Totally different. Mine has a lock on it.",
            ),
            slots: {
                actions: [actions({ replies: 4, boosts: 12, favourites: 48 })],
            },
        },
    ),
    story(
        "no-avatar-short",
        Post,
        { ...RODRICK, variant, time: "now" },
        {
            slot: text("no"),
            slots: { actions: [actions()] },
        },
    ),
    story(
        "pressed",
        Post,
        { ...GREG, variant, time: "5h" },
        {
            slot: text("Pressed states: boosted, favourited and bookmarked."),
            slots: {
                actions: [
                    actions(
                        { replies: 0, boosts: 1204, favourites: 38900 },
                        { boosted: true, favourited: true, bookmarked: true },
                    ),
                ],
            },
        },
    ),
    story(
        "long",
        Post,
        {
            author: 'Gregory Hamilton "Greg" Heffley, Middle School Survivor and Future Millionaire',
            handle: "@gregory.hamilton.heffley.the.third@a-very-long-instance-name.example",
            variant,
            time: "12h",
            profileHref: "#",
        },
        {
            slot:
                text(
                    "A very long unbroken link: https://example.com/a/really/long/path/that/keeps/going/and/going/and/going/forever/and/ever?with=query&and=more&and=even-more",
                ) + text("A second paragraph, to see the rhythm between them."),
            slots: { actions: [actions({ replies: 1 })] },
        },
    ),
    story(
        "media",
        Post,
        { ...GREG, variant, time: "1d" },
        {
            slot: text("Look what Rodrick left in the basement."),
            slots: {
                media: [picture],
                actions: [actions({ replies: 2, boosts: 3, favourites: 9 })],
            },
        },
    ),
    ...[2, 3, 4].map((n) =>
        story(
            `media-${n}`,
            Post,
            { ...GREG, variant, time: "1d" },
            {
                slot: text(`${n} pictures in one post.`),
                slots: {
                    media: pictures(n),
                    actions: [actions({ replies: n })],
                },
            },
        ),
    ),
    story(
        "boost-disabled",
        Post,
        { ...RODRICK, variant, time: "2h" },
        {
            slot: text("Followers only: it cannot be boosted."),
            slots: {
                actions: [
                    actions({ replies: 2, favourites: 7 }, {}, { boost: true }),
                ],
            },
        },
    ),
    story(
        "attachment",
        Post,
        { ...GREG, variant, time: "2d" },
        {
            slot: text("The rules, for anyone who asks."),
            slots: { media: [file], actions: [actions({ replies: 1 })] },
        },
    ),
    story(
        "attachments",
        Post,
        { ...GREG, variant, time: "2d" },
        {
            slot: text("Evidence, in several formats."),
            slots: { media: [files], actions: [actions({ favourites: 6 })] },
        },
    ),
    story(
        "cw-closed",
        Post,
        { ...GREG, variant, time: "1d", cw: "Spoilers for Twisted Wizard" },
        {
            slot: text("The dragon level is a lot harder than it looks."),
            slots: { media: [picture], actions: [actions({ favourites: 2 })] },
        },
    ),
    story(
        "cw-open",
        Post,
        {
            ...GREG,
            variant,
            time: "1d",
            cw: "Spoilers for Twisted Wizard",
            open: true,
        },
        {
            slot: text("The dragon level is a lot harder than it looks."),
            slots: { media: [picture], actions: [actions({ favourites: 2 })] },
        },
    ),
    story(
        "quote",
        Post,
        { ...GREG, variant, time: "3h" },
        {
            slot: text("Quoting this because it needs to be said."),
            slots: {
                quote: [quoted],
                actions: [actions({ replies: 1, boosts: 1, favourites: 5 })],
            },
        },
    ),
    story(
        "quote-unavailable",
        Post,
        { ...GREG, variant, time: "3h" },
        {
            slot: text("They deleted it, but I remember."),
            slots: {
                quote: [
                    story(
                        "quote-gone",
                        PostQuote,
                        { unavailable: true },
                        { slot: "This post is unavailable." },
                    ),
                ],
                actions: [actions({ replies: 1 })],
            },
        },
    ),
    story(
        "boost",
        Post,
        { ...ROWLEY, variant, time: "6h" },
        {
            slot: text(
                "Greg's journal is not a diary, it is a <em>journal</em>.",
            ),
            slots: {
                context: [boosted("Greg Heffley")],
                actions: [
                    actions(
                        { replies: 1, boosts: 7, favourites: 21 },
                        { boosted: true },
                    ),
                ],
            },
        },
    ),
    story(
        "reply",
        Post,
        { ...ROWLEY, variant, time: "1h" },
        {
            slot: text("Can I read it?"),
            slots: {
                context: [replying("@greg@heffley.example")],
                actions: [actions({ favourites: 1 })],
            },
        },
    ),
    story(
        "boosted-reply-with-visibility",
        Post,
        { ...RODRICK, variant, time: "30m" },
        {
            slot: text("Nobody reads it, dweeb."),
            slots: {
                context: [
                    boosted("Rowley Jefferson"),
                    replying("@rowley@jefferson.example"),
                ],
                meta: [visibility],
                actions: [actions({ replies: 2 })],
            },
        },
    ),
];

const thread = (variant: Variant): Story[] => [
    story(
        "self-thread",
        PostThread,
        { variant, label: "Thread by Greg Heffley" },
        {
            children: [
                story(
                    "one",
                    Post,
                    { ...GREG, variant, time: "3h" },
                    {
                        slot: text(
                            "A thread on why my journal is better than yours (1/3)",
                        ),
                        slots: {
                            actions: [actions({ replies: 1, favourites: 14 })],
                        },
                    },
                ),
                story(
                    "two",
                    Post,
                    { ...GREG, variant, time: "3h" },
                    {
                        slot: text(
                            "It has a lock. It has a cover. It has a really long second post, so the rail has a long way to run between the two avatars and I can check that it joins them.",
                        ),
                        slots: { actions: [actions({ favourites: 9 })] },
                    },
                ),
                story(
                    "three",
                    Post,
                    { ...GREG, variant, time: "3h" },
                    {
                        slot: text("Yours does not. (3/3)"),
                        slots: {
                            actions: [actions({ replies: 2, favourites: 21 })],
                        },
                    },
                ),
            ],
        },
    ),
    story(
        "conversation",
        PostThread,
        { variant, label: "Conversation" },
        {
            children: [
                story(
                    "ancestor",
                    Post,
                    { ...ROWLEY, variant, time: "4h" },
                    {
                        slot: text("Greg, what are we doing today?"),
                        slots: { actions: [actions({ replies: 1 })] },
                    },
                ),
                story(
                    "focus",
                    Post,
                    {
                        ...GREG,
                        variant,
                        featured: true,
                        time: "10:41 · 4 Nov 2026",
                        datetime: "2026-11-04T10:41",
                    },
                    {
                        slot: text(
                            "Nothing. Absolutely nothing. That is the plan.",
                        ),
                        slots: {
                            stats: [
                                story("stats", PostStats, {
                                    items: [
                                        { label: "boosts", count: 1204 },
                                        { label: "quotes", count: 3 },
                                        { label: "favourites", count: 38900 },
                                    ],
                                }),
                            ],
                            actions: [
                                actions({
                                    replies: 8,
                                    boosts: 1204,
                                    favourites: 38900,
                                }),
                            ],
                        },
                    },
                ),
            ],
        },
    ),
];

const featured = (variant: Variant) =>
    story(
        "featured",
        Post,
        {
            ...GREG,
            variant,
            featured: true,
            time: "10:41 · 4 Nov 2026",
            datetime: "2026-11-04T10:41",
        },
        {
            slot:
                text(
                    "The post a page is about gets a lead-sized body, and its counts in full.",
                ) + text("Second paragraph."),
            slots: {
                media: [picture],
                stats: [
                    story("stats", PostStats, {
                        items: [
                            { label: "boosts", count: 12 },
                            { label: "quotes", count: 0 },
                            { label: "favourites", count: 1048 },
                        ],
                    }),
                ],
                actions: [
                    actions({
                        replies: 3,
                        boosts: 12,
                        favourites: 1048,
                    }),
                ],
            },
        },
    );

export const postStories: StoryGroup[] = [
    {
        id: "post",
        title: "In a feed",
        category: "chat",
        source: "packages/ui/src/astro/blocks/post/post.astro",
        description:
            "A microblog post: replies, boosts, quotes, content warnings, media. Unframed and divided by a rule, for a timeline.",
        min: 26,
        stories: [...posts("feed"), featured("feed"), ...thread("feed")],
    },
    {
        id: "post-boxed",
        title: "Boxed",
        category: "chat",
        source: "packages/ui/src/astro/blocks/post/post.astro",
        description:
            "A post in its own box, for one embedded in a page rather than a timeline.",
        min: 26,
        stories: [
            ...posts("boxed").filter((s) =>
                ["default", "quote", "boost", "reply", "media"].includes(
                    s.name,
                ),
            ),
            featured("boxed"),
            ...thread("boxed"),
        ],
    },
];
