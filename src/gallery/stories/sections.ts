import Footer from "../../components/sections/footer.astro";
import Navbar from "../../components/sections/navbar.astro";
import SideHero from "../../components/sections/side-hero.astro";
import Sidebar from "../../components/sections/sidebar/sidebar.astro";
import SidebarGroup from "../../components/sections/sidebar/sidebar-group.astro";
import SidebarLink from "../../components/sections/sidebar/sidebar-link.astro";
import { friends } from "../../data/friends.ts";
import jessew from "../../images/88x31s/jessew.png";
import greg from "../../images/greg.jpg";
import { BODY, type StoryGroup, story } from "../story.ts";

const NAV_LINKS = [
    { href: "/", label: "Home", active: true },
    { href: "/projects", label: "Projects" },
    { href: "/blog", label: "Blog" },
];

// The links point at ids that don't exist, so the page's scroll-spy
// leaves them alone.
const SIDEBAR_GROUPS = [
    story(
        "guides",
        SidebarGroup,
        { title: "Guides" },
        {
            children: [
                story(
                    "start",
                    SidebarLink,
                    { href: "#demo-start", current: true },
                    { slot: "Getting started" },
                ),
                story(
                    "theming",
                    SidebarLink,
                    { href: "#demo-theming" },
                    { slot: "Theming" },
                ),
            ],
        },
    ),
    story(
        "reference",
        SidebarGroup,
        { title: "Reference" },
        {
            children: [
                story(
                    "tokens",
                    SidebarLink,
                    { href: "#demo-tokens", meta: 42 },
                    { slot: "Tokens" },
                ),
                story(
                    "components",
                    SidebarLink,
                    { href: "#demo-components", meta: 27 },
                    { slot: "Components" },
                ),
            ],
        },
    ),
];

export const sections: StoryGroup[] = [
    {
        id: "side-hero",
        title: "Side hero",
        category: "sections",
        source: "sections/side-hero.astro",
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
        category: "sections",
        source: "sections/navbar.astro",
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
        category: "sections",
        source: "sections/footer.astro",
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
        id: "sidebar",
        title: "Sidebar",
        category: "sections",
        source: "sections/sidebar/",
        description:
            "A collapsible menu on its own; open and sticky beside the content in a wide SidebarLayout, as on this page.",
        stories: [
            story(
                "collapsed",
                Sidebar,
                { label: "Docs" },
                { children: SIDEBAR_GROUPS },
            ),
            story(
                "open",
                Sidebar,
                { label: "Docs", open: true },
                { children: SIDEBAR_GROUPS },
            ),
        ],
    },
];
