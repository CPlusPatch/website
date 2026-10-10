/**
 * The front page's content.
 * The sections in components/page/ read it from here.
 */
import type { ComponentProps } from "astro/types";
import componentScreenshot from "../../docs/assets/gallery-dark.webp";
import liberTeaCover from "../audio/radio/a-cup-of-liber-tea.jpg";
import liberTea from "../audio/radio/a-cup-of-liber-tea.ogg";
import ariaMathCover from "../audio/radio/aria-math.jpg";
import ariaMath from "../audio/radio/aria-math.ogg";
import othersideCover from "../audio/radio/otherside.jpg";
import otherside from "../audio/radio/otherside.ogg";
import pigstepCover from "../audio/radio/pigstep.jpg";
import pigstep from "../audio/radio/pigstep.ogg";
import stillAliveCover from "../audio/radio/still-alive-radio-mix-clean.jpg";
import stillAlive from "../audio/radio/still-alive-radio-mix-clean.ogg";
import swedenCover from "../audio/radio/sweden.jpg";
import sweden from "../audio/radio/sweden.ogg";
import cyberGrindCover from "../audio/radio/the-cyber-grind.jpg";
import cyberGrind from "../audio/radio/the-cyber-grind.ogg";
import timeGoFishingCover from "../audio/radio/time-go-fishing.jpg";
import timeGoFishing from "../audio/radio/time-go-fishing.ogg";
import ultraChurchCover from "../audio/radio/ultrachurch.jpg";
import ultraChurch from "../audio/radio/ultrachurch.ogg";
import unstoppableForceCover from "../audio/radio/unstoppable-force.jpg";
import unstoppableForce from "../audio/radio/unstoppable-force.ogg";
import wantYouGoneCover from "../audio/radio/want-you-gone.jpg";
import wantYouGone from "../audio/radio/want-you-gone.ogg";
import warWithoutReasonCover from "../audio/radio/war-without-reason.jpg";
import warWithoutReason from "../audio/radio/war-without-reason.ogg";
import type Heatmap from "../components/blocks/heatmap/heatmap.astro";
import type MediaCard from "../components/blocks/media-card.astro";
import type { DialogueNode } from "../components/blocks/message/dialogue.ts";
import type Quote from "../components/blocks/quote.astro";
import type Rack from "../components/blocks/rack/rack.astro";
import type Radio from "../components/blocks/radio/radio.astro";
import type Stat from "../components/blocks/stat.astro";
import type EffectsBar from "../components/sections/effects-bar.astro";
import flaviScreenshot from "../images/assets/flavi-screenshot.png";
import joinMastodonScreenshot from "../images/assets/join-mastodon.de_en.webp";
import kitsuScreenshot from "../images/assets/kitsudotlife.png";
import versiaApiScreenshot from "../images/assets/lysand-apis.png";
import versiaFeScreenshot from "../images/assets/versia-fe.png";
import versiaScreenshot from "../images/assets/versia-pub-frontpage.png";
import versiaServerScreenshot from "../images/assets/versia-readme.png";
import autumn from "../images/avatars/autumn.webp";
import calciume from "../images/avatars/calciume.webp";
import erik from "../images/avatars/erik.jpg";
import kio from "../images/avatars/kio.webp";
import nhat from "../images/avatars/nhat.webp";
import redacted from "../images/avatars/redacted.jpg";
import zemi from "../images/avatars/zemi.webp";

export const contact = "mailto:contact@cpluspatch.com";

export const navLinks = [
    { href: "/", label: "Home", active: true },
    { href: "#projects", label: "Projects" },
    { href: "/blog", label: "Blog" },
    {
        href: "https://github.com/cpluspatch",
        label: "GitHub",
        external: true,
    },
];

export const effects: ComponentProps<typeof EffectsBar>["effects"] = [
    {
        label: "Scanlines",
        attr: "data-scanlines-toggle",
        key: "s",
        checked: true,
    },
    {
        label: "Crosshair",
        attr: "data-crosshair-toggle",
        key: "c",
        fine: true,
    },
    { label: "Invert theme", attr: "data-theme-toggle", key: "i" },
];

export const details = [
    { icon: "lucide:map-pin", label: "France" },
    { icon: "lucide:clock", label: "UTC+1" },
    { icon: "lucide:cpu", label: "Arch and NixOS" },
];

export const stats: ComponentProps<typeof Stat>[] = [
    { value: 8, suffix: "+", label: "Years in software development" },
    {
        value: 1,
        suffix: "M+",
        label: "Lines of code written",
        tone: "secondary",
    },
    { value: 4.1, suffix: "k", label: "Commits pushed", tone: "success" },
    {
        value: 99.9,
        suffix: "%",
        label: "Uptime of my homelab",
        tone: "warning",
    },
];

/**
 * Placeholder: a year of commits, a level from 0 to 4 for each day, Sunday to
 * Saturday down each week's column. Made up, but the same on every build:
 * busier midweek, quieter at weekends.
 */
const activity = Array.from({ length: 52 * 7 }, (_, i) => {
    const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const weekend = i < 52 || i >= 52 * 6;
    return Math.max(0, Math.round(noise * 5 - (weekend ? 3 : 1.5)));
});

/** The commit graph under the stats, which comes alive once scrolled to. */
export const commits = {
    /** Placeholder, like the levels. */
    title: "1,204 contributions in the last year",
    heatmap: {
        columns: 52,
        rows: 7,
        values: activity,
        until: new Date(),
        life: true,
        label: "Commits over the last year, as a heatmap playing the Game of Life",
        tone: "success",
    } satisfies ComponentProps<typeof Heatmap>,
};

/** The first is featured across the full width, above the rest. */
export const reviews: {
    author: ComponentProps<typeof Quote>["author"];
    body: string;
}[] = [
    {
        author: {
            name: "Erik Uden",
            title: "CEO, Uden AI",
            avatar: erik,
        },
        body: "Developers that are fast, utilize the newest available technology with ease, swiftly understand what you asked for, and can immerse themselves into your project to make case-by-case decisions in a way you would've made them, are already impossible to find. What makes CPlusPatch extraordinary is not just that, but is aided by the fact that CPlusPatch completes such tasks in a speed you'd expect there to be a full-time paid development team on the other end rather than a singular person.",
    },
    {
        author: { name: "Calciume", title: "CS Student", avatar: calciume },
        body: "I got to be witness to CPlusPatch's development of Fedibase, It really showed me how much he can accomplish when he sticks to a project. He was dedicated enough to make a fully featured Fediverse client that I'd argue is on par with other Fediverse clients, and he did it all on his own.",
    },
    {
        author: {
            name: "Kio",
            title: "CEO, 10Tails Inc",
            avatar: kio,
        },
        body: "CPlusPatch is very intelligent and resourceful when it comes to clear, on-point design. No matter what project he is tasked with, you'll get an honest answer, and a quicker turnaround.",
    },
    {
        author: {
            name: "Autumn",
            title: "Engineering Student",
            avatar: autumn,
        },
        body: "I'm impressed every time I see CPlusPatch working on something. He is extremely dedicated, and always amazes me with the quality and speed of his work. His enthusiasm for his projects is clear every time I talk with him.",
    },
    {
        author: {
            name: "Zemi",
            title: "CS Student",
            avatar: zemi,
        },
        body: "CPlusPatch is one of the most skilled and knowledgeable developers I have ever worked with. He is able to take on any task and complete it with ease. He always maintains a positive attitude and a sense of humor, which makes him a joy to work with.",
    },
    {
        author: {
            name: "Nhat",
            title: "Physics and Engineering Student",
            avatar: nhat,
        },
        body: "CPlusPatch is the most talented programmer I have had the pleasure of knowing. He can solve difficult problems using remarkable efficiency and is always happy to assist me with my own projects. Truly a person of all time.",
    },
    {
        author: {
            name: "[REDACTED]",
            title: "Developer",
            avatar: redacted,
        },
        body: "All of CPlusPatch's projects turn out looking stunning. They make any project look easy, yet you'd be hard-pressed to find someone who works as quick with nearly the same results.",
    },
];

export const projects: (ComponentProps<typeof MediaCard> & {
    body: string;
})[] = [
    {
        title: "Website",
        body: "This site, and the component library it's built from. Plain HTML and CSS, with JavaScript only where it's needed.",
        header: {
            src: componentScreenshot,
            alt: "The component library",
        },
        links: [
            {
                href: "https://github.com/cpluspatch/website",
                icon: "lucide:github",
                label: "Source",
            },
            { href: "/gallery/", icon: "lucide:globe", label: "Gallery" },
        ],
    },
    {
        title: "Versia Protocol",
        body: "Fully documented protocol specification for Versia, a decentralized federation protocol that focuses on good experience and ease of implementation.",
        header: {
            src: versiaScreenshot,
            alt: "The Versia front page with multiple sections and a navigation bar",
        },
        links: [
            {
                href: "https://versia.pub",
                icon: "lucide:globe",
                label: "Website",
            },
            {
                href: "https://github.com/versia-pub/docs",
                icon: "lucide:github",
                label: "Source",
            },
        ],
    },
    {
        title: "Versia Server",
        body: "Reference implementation of the Versia protocol. High-quality, efficient and configurable server software.",
        header: {
            src: versiaServerScreenshot,
            alt: "The Versia Server README",
        },
        links: [
            {
                href: "https://github.com/versia-pub/server",
                icon: "lucide:github",
                label: "Source",
            },
            {
                href: "https://vs.cpluspatch.com",
                icon: "lucide:server",
                label: "Demo",
            },
            {
                href: "https://opencollective.com/lysand",
                icon: "lucide:euro",
                label: "Donate",
            },
        ],
    },
    {
        title: "Versia-FE",
        body: "Frontend for Versia Server, made with Vue 3 and Tailwind CSS. It's a modern, responsive and fast web application.",
        header: {
            src: versiaFeScreenshot,
            alt: "Outdated Versia-FE screenshot, looking like a dashboard with a sidebar and a main content area",
        },
        links: [
            {
                href: "https://github.com/versia-pub/frontend",
                icon: "lucide:github",
                label: "Source",
            },
            {
                href: "https://vs.cpluspatch.com",
                icon: "lucide:server",
                label: "Demo",
            },
            {
                href: "https://opencollective.com/lysand",
                icon: "lucide:euro",
                label: "Donate",
            },
        ],
    },
    {
        title: "Versia APIs",
        body: "APIs for TypeScript Versia implementations, including federation and clients. Well-documented, small and efficient.",
        header: {
            src: versiaApiScreenshot,
            alt: "The Versia APIs README",
        },
        links: [
            {
                href: "https://github.com/versia-pub/api",
                icon: "lucide:github",
                label: "Source",
            },
            {
                href: "https://www.npmjs.com/package/@versia/federation",
                icon: "lucide:package",
                label: "NPM",
            },
            {
                href: "https://jsr.io/@versia/federation",
                icon: "lucide:package",
                label: "JSR",
            },
            {
                href: "https://opencollective.com/lysand",
                icon: "lucide:euro",
                label: "Donate",
            },
        ],
    },
    {
        title: "Join Mastodon",
        body: "A landing page for mastodon.de, a social media with no ads, no tracking, and no algorithms. Made with Nuxt.js and Tailwind CSS.",
        header: {
            src: joinMastodonScreenshot,
            alt: "The website for joinmastodon.de, with big hero text section a screenshot of the Mastodon app",
        },
        links: [
            {
                href: "https://github.com/Mastodon-DE/joinmastodon",
                icon: "lucide:github",
                label: "Source",
            },
            {
                href: "https://join-mastodon.de",
                icon: "lucide:link",
                label: "Website",
            },
        ],
    },
    {
        title: "Flavi",
        body: "Flavi is an open-source client for the Matrix ecosystem with the goal of having a clean, familiar interface for users of Discord and the like.",
        header: {
            src: flaviScreenshot,
            alt: "The Flavi app, with a Discord-like interface and a dark theme",
        },
        links: [
            {
                href: "https://github.com/CPlusPatch/flavi",
                icon: "lucide:github",
                label: "Source",
            },
        ],
    },
    {
        title: "Kitsu.life",
        body: "Website for the Kitsu service suite, showcasing features and the community for Kitsu.",
        header: {
            src: kitsuScreenshot,
            alt: "The Kitsu.life website",
        },
        links: [
            {
                href: "https://github.com/cpluspatch/kitsu-landing",
                icon: "lucide:github",
                label: "Source",
            },
            {
                href: "https://kitsu.life",
                icon: "lucide:link",
                label: "Website",
            },
        ],
    },
];

/** The homelab rack, and the ways requests take through it. */
export const rack: ComponentProps<typeof Rack> = {
    label: "rack-01",
    units: [
        { name: "core-sw", about: "48 × 10 GbE", kind: "switch" },
        { name: "edge", about: "proxy · firewall · tls" },
        { name: "app-01", about: "web · auth · chat" },
        { name: "app-02", about: "photos · files · social" },
        { name: "blank", kind: "blank" },
        { name: "game-01", about: "minecraft · factorio" },
        {
            name: "db-01",
            about: "postgres · redis · metrics",
            kind: "storage",
            height: 2,
        },
        { name: "nas", about: "media · backups", kind: "storage", height: 2 },
    ],
    flows: [
        { name: "web", path: ["edge", "app-01", "db-01"], tone: "primary" },
        { name: "chat", path: ["edge", "app-01", "db-01"], tone: "success" },
        {
            name: "photos",
            path: ["edge", "app-02", "db-01", "nas"],
            tone: "secondary",
        },
        { name: "game", path: ["edge", "game-01"], tone: "warning" },
    ],
};

export const chat: DialogueNode = {
    messages: ["Hello, I'm Verity!", "Ask me anything... I know everything."],
    options: [
        {
            label: "How about you ask me a question?",
            next: {
                messages: ["What's the capital of France?"],
                options: [
                    {
                        label: "Paris.",
                        reply: "Oui oui oui, it is Paris.",
                        next: {
                            messages: ["What does the cow say?"],
                            options: [
                                {
                                    label: "Moo.",
                                    reply: "Oh moo moo moo",
                                    next: { messages: ["I speak that too!"] },
                                },
                                {
                                    label: "Bing bong.",
                                    next: { messages: ["Try again."] },
                                },
                            ],
                        },
                    },
                    {
                        label: "Idk",
                        next: { messages: ["You're no fun."] },
                    },
                ],
            },
        },
        {
            label: "How fat are your booty cheeks?",
            next: {
                action: "shake",
                messages: [
                    "I guess you could say they're pretty fat.",
                    "*shake shake shake*",
                ],
                options: [
                    {
                        label: "Verity, do it jiggle?",
                        next: { messages: ["shut up"] },
                    },
                    {
                        label: "Oh great heavens.",
                        next: {
                            messages: [
                                "Oops sorry *burps*, I'm very gassy today.",
                            ],
                        },
                    },
                ],
            },
        },
        {
            label: "Can you talk cuter?",
            next: {
                action: "uwuify",
                messages: ["Of course! Is this better?"],
                options: [
                    {
                        label: "Much better",
                        next: { messages: ["Hehe, thank you!"] },
                    },
                    {
                        label: "Please stop",
                        next: {
                            messages: ["No."],
                            options: [
                                {
                                    label: "I said stop!",
                                    next: {
                                        action: "swear",
                                        messages: [
                                            "You want something else?",
                                            "Fine. You asked for it.",
                                        ],
                                        options: [
                                            {
                                                label: "Language!",
                                                next: {
                                                    messages: ["You asked."],
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
    ],
};

export const socials = [
    {
        name: "GitHub",
        href: "https://github.com/cpluspatch",
        icon: "logos:github-icon",
    },
    {
        name: "Signal",
        href: "https://signal.me/#eu/29gu1hAuAfCAifqIvTWNB2u4hmlVvk9VnCEP15r25Hix_8nBBEBEx7OHuTsuemPX",
        icon: "logos:signal",
    },
    { name: "Email", href: contact, icon: "lucide:at-sign" },
    {
        name: "Matrix",
        href: "https://matrix.to/#/@jesse:cpluspatch.dev",
        icon: "matrix",
    },
];

/** The music corner window's radio, played in this order. */
export const radioTracks: ComponentProps<typeof Radio>["tracks"] = [
    { src: sweden, cover: swedenCover, title: "Sweden", artist: "C418" },
    { src: ariaMath, cover: ariaMathCover, title: "Aria Math", artist: "C418" },
    {
        src: otherside,
        cover: othersideCover,
        title: "otherside",
        artist: "Lena Raine",
    },
    {
        src: pigstep,
        cover: pigstepCover,
        title: "Pigstep",
        artist: "Lena Raine",
    },
    {
        src: timeGoFishing,
        cover: timeGoFishingCover,
        title: "Time Go Fishing",
        artist: "Daniel Pemberton",
    },
    {
        src: liberTea,
        cover: liberTeaCover,
        title: "A Cup of Liber-Tea",
        artist: "Wilbert Roget, II",
    },
    {
        src: unstoppableForce,
        cover: unstoppableForceCover,
        title: "Unstoppable Force",
        artist: "Heaven Pierce Her",
    },
    {
        src: warWithoutReason,
        cover: warWithoutReasonCover,
        title: "War Without Reason",
        artist: "Heaven Pierce Her",
    },
    {
        src: cyberGrind,
        cover: cyberGrindCover,
        title: "The Cyber Grind",
        artist: "Meganeko",
    },
    {
        src: ultraChurch,
        cover: ultraChurchCover,
        title: "UltraChurch",
        artist: "Keygen Church",
    },
    {
        src: stillAlive,
        cover: stillAliveCover,
        title: "Still Alive (Radio Mix)",
        artist: "Aperture Science Psychoacoustic Laboratories",
    },
    {
        src: wantYouGone,
        cover: wantYouGoneCover,
        title: "Want You Gone",
        artist: "Aperture Science Psychoacoustic Laboratories",
    },
];
