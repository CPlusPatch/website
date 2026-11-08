/**
 * The front page's content.
 * The sections in components/page/ read it from here.
 */

import type Heatmap from "@cpluspatch/ui/astro/blocks/heatmap/heatmap.astro";
import type MediaCard from "@cpluspatch/ui/astro/blocks/media-card.astro";
import type Quote from "@cpluspatch/ui/astro/blocks/quote.astro";
import type Stat from "@cpluspatch/ui/astro/blocks/stat.astro";
import type { DisplayEffect } from "@cpluspatch/ui/astro/sections/display/display-menu.astro";
import type { DialogueNode } from "@cpluspatch/ui/behaviours/interactive-message.ts";
import type { ComponentProps } from "astro/types";
import componentScreenshot from "../../docs/assets/gallery-dark.webp";
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
import verity from "./verity.json" with { type: "json" };

export const contact = "mailto:contact@cpluspatch.com";

/**
 * The anonymous inbox on the contact page: messages are PUT to the ntfy
 * topic, which pushes them to my phone, and the same topic's event stream
 * feeds the live list.
 */
export const inbox = {
    topic: "https://ntfy.sh/3MFIHQw4F23Gs7dz",
};

export const navLinks = [
    { href: "/", label: "Home" },
    { href: "/#projects", label: "Projects" },
    { href: "/contact", label: "Contact" },
    {
        href: "https://github.com/cpluspatch",
        label: "GitHub",
        external: true,
    },
];

export const effects: DisplayEffect[] = [
    { name: "scanlines", label: "Scanlines", key: "s" },
    // Not in the menu: Alt+Shift+J only (see lib/page-effects.ts, jesse).
    { name: "jesse", label: "Jesse", key: "j", hidden: true },
];

export const details = [
    { icon: "lucide:map-pin", label: "France" },
    { icon: "lucide:clock", label: "UTC+1" },
    { icon: "lucide:cpu", label: "Arch and NixOS" },
];

/** Figures set in the sentences of the stats and homelab sections. */
export const figures = {
    years: { value: 8, suffix: "+" },
    lines: { value: 1, suffix: "M" },
    commits: { value: 6, suffix: "k" },
    uptime: { value: 99.9, suffix: "%" },
} satisfies Record<string, ComponentProps<typeof Stat>>;

/** The same figures as cards, with labels, for the desktop's readme. */
export const stats: ComponentProps<typeof Stat>[] = [
    { ...figures.years, label: "Years in software development" },
    { ...figures.lines, suffix: "M+", label: "Lines of code written" },
    { ...figures.commits, label: "Commits pushed" },
    { ...figures.uptime, label: "Uptime of my homelab" },
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
            title: "Head, Uden AI",
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
            title: "Head, 10Tails Inc",
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

/**
 * Verity's chat (see interactive-message.astro). His lines are in
 * verity.json, which is plain JSON as that is what the build imports.
 * Options that name an `action` run a page effect (dialogue-actions.ts).
 */
export const chat: DialogueNode = verity;

/**
 * Where to reach me. `handle` is shown on the contact page, and `copy` adds a
 * copy button for the value that isn't just the link.
 */
export const socials: {
    name: string;
    href: string;
    icon: string;
    handle: string;
    copy?: string;
}[] = [
    {
        name: "Matrix",
        href: "https://matrix.to/#/@jesse:cpluspatch.dev",
        icon: "matrix",
        handle: "@jesse:cpluspatch.dev",
        copy: "@jesse:cpluspatch.dev",
    },
    {
        name: "Email",
        href: contact,
        icon: "lucide:at-sign",
        handle: "contact@cpluspatch.com",
        copy: "contact@cpluspatch.com",
    },
    {
        name: "Signal",
        href: "https://signal.me/#eu/29gu1hAuAfCAifqIvTWNB2u4hmlVvk9VnCEP15r25Hix_8nBBEBEx7OHuTsuemPX",
        icon: "signal",
        handle: "@cpluspatch.95",
        copy: "cpluspatch.95",
    },
    {
        name: "GitHub",
        href: "https://github.com/cpluspatch",
        icon: "lucide:github",
        handle: "github.com/cpluspatch",
    },
];
