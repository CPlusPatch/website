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
import flaviScreenshot from "../images/assets/flavi-screenshot.png";
import homeDark from "../images/assets/home-dark.webp";
import homeLight from "../images/assets/home-light.webp";
import joinMastodonScreenshot from "../images/assets/join-mastodon.de_en.webp";
import kitsuScreenshot from "../images/assets/kitsu.webp";
import versiaApiScreenshot from "../images/assets/lysand-apis.png";
import versiaDark from "../images/assets/versia-dark.webp";
import versiaFeDark from "../images/assets/versia-fe-dark.webp";
import versiaFeLight from "../images/assets/versia-fe-light.webp";
import versiaLight from "../images/assets/versia-light.webp";
import versoDark from "../images/assets/verso-dark.webp";
import versoLight from "../images/assets/verso-light.webp";
import autumn from "../images/avatars/autumn.webp";
import calciume from "../images/avatars/calciume.webp";
import erik from "../images/avatars/erik.jpg";
import kio from "../images/avatars/kio.webp";
import nhat from "../images/avatars/nhat.webp";
import redacted from "../images/avatars/redacted.jpg";
import zemi from "../images/avatars/zemi.webp";
import verity from "./verity.json" with { type: "json" };

export const contact = "mailto:contact@cpluspatch.com";

/** Who I am, in the front page's hero and the desktop's readme. */
export const intro = {
    headline: "I write software.",
    lead: "I study engineering in France. Most of my time goes into Versia, a federation protocol, and the rest into my personal homelab.",
};

/** Over the ways to reach me, on the contact page and the desktop. */
export const contactNote =
    'Say what you want in your first message: I ignore a bare "Hello", since most of them are scams.';

/** Over the anonymous inbox. */
export const inboxNote =
    "Anything you send here goes to my phone, without your name. It also appears in the feed below for anyone who has this page open.";

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
    commits: { value: 6, suffix: "k" },
    uptime: { value: 99.9, suffix: "%" },
} satisfies Record<string, ComponentProps<typeof Stat>>;

/** The same figures as cards, with labels, for the desktop's readme. */
export const stats: ComponentProps<typeof Stat>[] = [
    { ...figures.years, label: "Years writing software" },
    { ...figures.commits, label: "Commits" },
    { ...figures.uptime, label: "Homelab uptime" },
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
    /** The real count; the levels under it are still made up. */
    title: "2,236 contributions in the last year",
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
        body: "I got to be witness to CPlusPatch's development of Fedibase. It really showed me how much he can accomplish when he sticks to a project. He was dedicated enough to make a fully featured Fediverse client that I'd argue is on par with other Fediverse clients, and he did it all on his own.",
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

/**
 * Versia, featured above the other projects on the home page. Its parts are
 * the projects whose titles start with "Versia".
 */
export const versia = {
    title: "Versia",
    /** The site in each scheme, shown to match the reader's. */
    shots: {
        light: versiaLight,
        dark: versiaDark,
        alt: "The Versia site, headed Federation you can read, with a signed message beside notes on it",
    },
    body: "A federation protocol for social apps: plain JSON over signed HTTP requests, with a small core and namespaced extensions. It's heavily inspired by ActivityPub, without JSON-LD or activity wrappers. I wrote the spec, the reference server, a web client and the TypeScript libraries.",
    links: [
        { href: "https://versia.pub", icon: "lucide:globe", label: "Website" },
        {
            href: "https://github.com/versia-pub",
            icon: "lucide:github",
            label: "Source",
        },
        {
            href: "https://opencollective.com/lysand",
            icon: "lucide:euro",
            label: "Donate",
        },
    ],
};

/**
 * A header is in the dark scheme; `light` is the same capture in the light
 * one, which the home page shows to readers in that scheme.
 */
export const projects: (Omit<ComponentProps<typeof MediaCard>, "header"> & {
    body: string;
    /** Part of Versia, so on the home page under it, not in the list. */
    versia?: boolean;
    header?: NonNullable<ComponentProps<typeof MediaCard>["header"]> & {
        light?: ImageMetadata;
    };
})[] = [
    {
        title: "Website",
        body: "This site, and the component library it's built from. Every page works without JavaScript; scripts only add to it.",
        header: {
            src: homeDark,
            light: homeLight,
            alt: "The front page of this site, with a terminal beside the introduction",
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
        versia: true,
        body: "The specification, written for people implementing a Versia server or library.",
        header: {
            src: versiaDark,
            alt: "The Versia site, headed Federation you can read, with a signed message beside notes on it",
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
        title: "Verso",
        versia: true,
        body: "The reference implementation of Versia, in TypeScript on Deno. It also implements Mastodon's client API, so Mastodon apps can use it. It's in early development.",
        header: {
            src: versoDark,
            light: versoLight,
            alt: "The Verso README on GitHub",
        },
        links: [
            {
                href: "https://github.com/versia-pub/verso",
                icon: "lucide:github",
                label: "Source",
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
        versia: true,
        body: "The web client for Versia Server, in Vue 3 and Tailwind. It's what the demo instance runs.",
        header: {
            src: versiaFeDark,
            light: versiaFeLight,
            alt: "Versia-FE, a timeline of posts beside a navigation sidebar",
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
        versia: true,
        body: "TypeScript libraries for building Versia servers and clients, on npm and JSR.",
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
        body: "The landing page for mastodon.de, a Mastodon server with no ads and no tracking. Built with Nuxt and Tailwind.",
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
        body: "A Matrix client laid out like Discord, so people coming from it would feel at home. It's no longer maintained.",
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
        body: "The website for Kitsu's services, including its social network.",
        header: {
            src: kitsuScreenshot,
            alt: "Kitsu.life, headed Kitsu provides you with a family, beside a laptop showing its social app",
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
