/*
 * The component matrix.
 *
 * This file is the single list of every component state worth looking at.
 * /gallery renders it; keeping it as plain data means anything else that
 * needs the matrix (visual or a11y tests, say) can import it directly.
 *
 * This is simplistic on purpose to avoid the complexity of a full storybook.
 * It does not attempt to express every possible prop combination, only the
 * ones that are likely to be useful to a developer.
 *
 * Composites nest through `children` (the default slot) and `slots` (named
 * slots), each holding more stories -- see the carousel.
 */
// deno-lint-ignore-file no-explicit-any

import type { ComponentProps } from "astro/types";
import Alert from "./components/alert.astro";
import Badge from "./components/badge.astro";
import Badge88x31 from "./components/badge-88x31.astro";
import Button from "./components/button.astro";
import ButtonGroup from "./components/button-group.astro";
import Card from "./components/card.astro";
import CarouselItem from "./components/carousel/carousel-item.astro";
import CarouselPreview from "./components/carousel/carousel-preview.astro";
import Carousel from "./components/carousel.astro";
import Footer from "./components/footer.astro";
import SideHero from "./components/layout/side-hero.astro";
import Logos from "./components/logos.astro";
import Navbar from "./components/navbar.astro";
import Select from "./components/select.astro";
import Terminal from "./components/terminal.astro";
import Toggle from "./components/toggle.astro";
import { technologies } from "./data/experience.ts";
import { friends } from "./data/friends.ts";
import jessew from "./images/88x31s/jessew.png";
import greg from "./images/greg.jpg";
import { TONES } from "./lib/tone.ts";

/** Any `.astro` component. */
// biome-ignore lint/suspicious/noExplicitAny: matches astro's own ComponentProps constraint
type Component = (args: any) => any;

export interface Story {
    /** Unique within its group. Used for the `data-story` hook. */
    name: string;
    component: Component;
    props: Record<string, unknown>;
    /** Icon rendered before the slot content, for components that take one in a slot. */
    icon?: string;
    /** Slot content, as raw HTML. */
    slot?: string;
    /** Stories rendered in the default slot, after `slot`. */
    children?: Story[];
    /** Stories rendered in named slots. */
    slots?: Record<string, Story[]>;
}

export interface StoryGroup {
    /** Unique. Used for the `data-story` hook. */
    id: string;
    title: string;
    description?: string;
    /**
     * Minimum gallery cell width, in rem, or "full" for one full-width cell
     * per row. Wider components need more. Defaults to 16.
     */
    min?: number | "full";
    stories: Story[];
}

/**
 * Builds a story with its props checked against the component's own Props
 * type -- so a renamed or mistyped prop fails `astro check` rather than
 * silently rendering the default.
 */
const story = <T extends Component>(
    name: string,
    component: T,
    props: ComponentProps<T>,
    content: Omit<Story, "name" | "component" | "props"> = {},
): Story => ({ name, component, props, ...content });

const VARIANTS = ["solid", "outline", "ghost", "link"] as const;
const BADGE_VARIANTS = ["solid", "outline", "ghost"] as const;
const SIZES = ["lg", "default", "sm"] as const;

const BODY =
    "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>";

const SELECT_OPTIONS = [
    { value: "one", label: "Option one" },
    { value: "two", label: "Option two" },
    { value: "three", label: "Option three" },
];

const NAV_LINKS = [
    { href: "/", label: "Home", active: true },
    { href: "/projects", label: "Projects" },
    { href: "/blog", label: "Blog" },
];

const SLIDES = [
    { title: "Side hero", body: "A slide can hold any component." },
    { title: "Plain card", body: "This is the second slide." },
    { title: "Another card", body: "This is the third slide." },
    { title: "Last one", body: "This is the fourth slide." },
];

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const groups: StoryGroup[] = [
    {
        id: "effects",
        title: "Effects",
        min: 10,
        stories: [
            story("crosshair", Toggle, {
                label: "Crosshair",
                "data-crosshair-toggle": true,
            }),
            story("scanlines", Toggle, {
                label: "Scanlines",
                "data-scanlines-toggle": true,
            }),
            story("lift-shadow", Toggle, {
                label: "Lift shadow",
                "data-lift-shadow-toggle": true,
            }),
            story("theme", Toggle, {
                label: "Invert theme",
                "data-theme-toggle": true,
            }),
        ],
    },
    {
        id: "button-matrix",
        title: "Buttons — variant × tone",
        description: "Fill style and colour are independent axes.",
        min: 10,
        stories: VARIANTS.flatMap((variant) =>
            TONES.map((tone) =>
                story(
                    `${variant}-${tone}`,
                    Button,
                    { variant, tone },
                    { icon: "lucide:star", slot: title(tone) },
                ),
            ),
        ),
    },
    {
        id: "button-size",
        title: "Buttons — size and state",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Button, { size }, { slot: title(size) }),
            ),
            story(
                "icon",
                Button,
                { size: "icon", "aria-label": "Favourite" },
                { icon: "lucide:star" },
            ),
            story("disabled", Button, { disabled: true }, { slot: "Disabled" }),
            story(
                "anchor",
                Button,
                { as: "a", href: "#main" },
                { slot: "Anchor" },
            ),
            story("no-lift", Button, { lift: false }, { slot: "No lift" }),
        ],
    },
    {
        id: "button-group",
        title: "Button groups",
        min: 16,
        stories: [
            story(
                "default",
                ButtonGroup,
                { label: "Alignment" },
                {
                    children: ["Left", "Centre", "Right"].map((label) =>
                        story(
                            label.toLowerCase(),
                            Button,
                            { variant: "outline", lift: false },
                            { slot: label },
                        ),
                    ),
                },
            ),
            story(
                "icons",
                ButtonGroup,
                { label: "View" },
                {
                    children: ["list", "layout-grid", "columns-2"].map((icon) =>
                        story(
                            icon,
                            Button,
                            {
                                size: "icon",
                                variant: "outline",
                                tone: "neutral",
                                lift: false,
                                "aria-label": icon,
                            },
                            { icon: `lucide:${icon}` },
                        ),
                    ),
                },
            ),
            story(
                "disabled-member",
                ButtonGroup,
                { label: "Actions" },
                {
                    children: [
                        story("one", Button, { lift: false }, { slot: "One" }),
                        story(
                            "two",
                            Button,
                            { lift: false, disabled: true },
                            { slot: "Two" },
                        ),
                        story(
                            "three",
                            Button,
                            { lift: false },
                            { slot: "Three" },
                        ),
                    ],
                },
            ),
        ],
    },
    {
        id: "badge-matrix",
        title: "Badges — variant × tone",
        description: "Fill style and colour are independent axes.",
        min: 10,
        stories: BADGE_VARIANTS.flatMap((variant) =>
            TONES.map((tone) =>
                story(
                    `${variant}-${tone}`,
                    Badge,
                    { variant, tone },
                    { slot: title(tone) },
                ),
            ),
        ),
    },
    {
        id: "badge-size",
        title: "Badges — size",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Badge, { size }, { slot: title(size) }),
            ),
            ...SIZES.map((size) =>
                story(
                    `icon-${size}`,
                    Badge,
                    { size },
                    { icon: "lucide:badge-check", slot: title(size) },
                ),
            ),
        ],
    },
    {
        id: "toggle",
        title: "Toggles",
        min: 10,
        stories: [
            story("default", Toggle, { label: "Example" }),
            story("checked", Toggle, { label: "Example", checked: true }),
            story("disabled", Toggle, { label: "Example", disabled: true }),
            story("checked-disabled", Toggle, {
                label: "Example",
                checked: true,
                disabled: true,
            }),
        ],
    },
    {
        id: "select",
        title: "Selects",
        min: 10,
        stories: [
            story("default", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
            }),
            story("selected", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                value: "two",
            }),
            story("disabled", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                disabled: true,
            }),
        ],
    },
    {
        id: "88x31",
        title: "88x31s",
        min: 8,
        stories: [
            ...friends.map((friend) =>
                story(friend.name.toLowerCase(), Badge88x31, {
                    image: friend.image,
                    href: friend.href,
                    alt: `A small icon representing ${friend.name}'s website`,
                }),
            ),
        ],
    },
    {
        id: "card",
        title: "Cards",
        min: 16,
        stories: [
            ...TONES.map((tone) =>
                story(
                    tone,
                    Card,
                    { tone },
                    { slot: `<h3>${title(tone)}</h3>${BODY}` },
                ),
            ),
            story(
                "no-lift",
                Card,
                { lift: false },
                {
                    slot: "<h3>No lift</h3><p>Hover does nothing on this one.</p>",
                },
            ),
        ],
    },
    {
        id: "alert",
        title: "Alerts",
        min: 24,
        stories: [
            story(
                "default",
                Alert,
                {},
                {
                    slot: "<h3>Alert title</h3><p>An alert with no icon and no variant.</p>",
                },
            ),
            story(
                "success",
                Alert,
                { variant: "success", icon: "lucide:badge-check" },
                {
                    slot: "<h3>Success alert</h3><p>The action completed successfully.</p>",
                },
            ),
            story(
                "warning",
                Alert,
                { variant: "warning", icon: "lucide:alert-triangle" },
                {
                    slot: "<h3>Warning alert</h3><p>Something might need your attention.</p>",
                },
            ),
            story(
                "destructive",
                Alert,
                {
                    variant: "destructive",
                    icon: "lucide:alert-circle",
                    live: "assertive",
                },
                {
                    slot: "<h3>Destructive alert</h3><p>This action could have serious consequences.</p>",
                },
            ),
        ],
    },
    {
        id: "side-hero",
        title: "Side hero",
        min: "full",
        stories: (["right", "left"] as const).map((side) =>
            story(
                side,
                SideHero,
                { side, image: { src: greg, alt: "Greg Heffley" } },
                { slot: `<h2>Image on the ${side}</h2>${BODY}` },
            ),
        ),
    },
    {
        id: "navbar",
        title: "Navbar",
        min: "full",
        stories: [
            story("default", Navbar, { title: "Jesse", links: NAV_LINKS }),
            story("final-link", Navbar, {
                title: "Jesse",
                links: NAV_LINKS,
                finalLink: { href: "/contact", label: "Contact" },
            }),
            story("external", Navbar, {
                title: "Jesse",
                links: [
                    ...NAV_LINKS,
                    {
                        href: "https://github.com/cpluspatch",
                        label: "GitHub",
                        external: true,
                    },
                ],
                finalLink: {
                    href: "https://example.com",
                    label: "Elsewhere",
                    external: true,
                },
            }),
            story("no-links", Navbar, { title: "Jesse", links: [] }),
            story("many-links", Navbar, {
                title: "A rather long site title",
                links: Array.from({ length: 8 }, (_, i) => ({
                    href: `/page-${i + 1}`,
                    label: `Page ${i + 1}`,
                    active: i === 0,
                })),
                finalLink: { href: "/contact", label: "Contact" },
            }),
        ],
    },
    {
        id: "footer",
        title: "Footer",
        min: "full",
        stories: [
            story("default", Footer, {
                copyright: {
                    license: "CC BY-SA 4.0",
                    holder: "Testy McTestface",
                },
                tagline:
                    "This was a triumph\nI'm making a note here\nHuge success",
                socials: [
                    {
                        name: "GitHub",
                        href: "https://github.com/cpluspatch",
                        icon: "logos:github-icon",
                    },
                    {
                        name: "Twitter",
                        href: "https://twitter.com/grok",
                        icon: "logos:twitter",
                    },
                    {
                        name: "Mastodon",
                        href: "https://mastodon.social/@grok",
                        icon: "logos:mastodon-icon",
                    },
                    {
                        name: "LinkedIn",
                        href: "https://www.linkedin.com/in/grok",
                        icon: "logos:linkedin-icon",
                    },
                    {
                        name: "Email",
                        href: "mailto:grok@example.com",
                        icon: "lucide:at-sign",
                    },
                ],
                badge88x31: {
                    image: jessew,
                    alt: "A cool badge with a cool description.",
                },
                friends: friends.map((friend) => ({
                    name: friend.name,
                    href: friend.href,
                    image: friend.image,
                    alt: `A small icon representing ${friend.name}'s website`,
                })),
            }),
        ],
    },
    {
        id: "logos",
        title: "Logos",
        min: "full",
        stories: [story("default", Logos, { items: technologies, rows: 5 })],
    },
    {
        id: "carousel",
        title: "Carousel",
        min: "full",
        stories: [
            story(
                "default",
                Carousel,
                { label: "Component examples" },
                {
                    children: [
                        story(
                            "slide-1",
                            CarouselItem,
                            {},
                            {
                                children: [
                                    story(
                                        "hero",
                                        SideHero,
                                        {
                                            image: {
                                                src: greg,
                                                alt: "Greg Heffley",
                                            },
                                        },
                                        {
                                            slot: `<h2>${SLIDES[0].title}</h2><p>${SLIDES[0].body}</p>`,
                                            children: [
                                                story(
                                                    "cta",
                                                    Button,
                                                    {},
                                                    { slot: "Learn more" },
                                                ),
                                            ],
                                        },
                                    ),
                                ],
                            },
                        ),
                        ...SLIDES.slice(1).map((slide, i) =>
                            story(
                                `slide-${i + 2}`,
                                CarouselItem,
                                {},
                                {
                                    children: [
                                        story(
                                            "card",
                                            Card,
                                            {},
                                            {
                                                slot: `<h3>${slide.title}</h3><p>${slide.body}</p>`,
                                            },
                                        ),
                                    ],
                                },
                            ),
                        ),
                    ],
                    slots: {
                        previews: SLIDES.map((slide, i) =>
                            story(
                                `preview-${i + 1}`,
                                CarouselPreview,
                                {},
                                {
                                    slot: `<strong>${i + 1}</strong>${slide.title}`,
                                },
                            ),
                        ),
                    },
                },
            ),
        ],
    },
    {
        id: "terminal",
        title: "Terminal",
        min: 24,
        stories: [
            story("default", Terminal, {
                entries: [
                    {
                        command: "whoami",
                        output: "jessew",
                    },
                    {
                        command: "uname -a",
                        output: "Linux web-ng 7.2.8-2-cachyos #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
                    },
                    {
                        command: "ls ~/projects",
                        output: "web-ng\nversia\ndotfiles",
                    },
                    {
                        command: "cat motd.txt",
                        output: "Welcome! Type a command below.\nTry `help` for a list of commands.",
                    },
                ],
            }),
            story("empty", Terminal, { entries: [] }),
            story("interactive", Terminal, {
                interactive: true,
            }),
            story("interactive with history", Terminal, {
                interactive: true,
                entries: [
                    {
                        command: "whoami",
                        output: "jessew",
                    },
                ],
            }),
        ],
    },
];
