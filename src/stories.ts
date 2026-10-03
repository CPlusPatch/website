/*
 * The component matrix.
 *
 * This file is the single list of every component state worth looking at.
 * /gallery renders it as a gallery; automated tests can just look at it, so
 * adding a state here is the only step needed to get it covered everywhere.
 *
 * This is simplistic on purpose to avoid the complexity of a full storybook.
 * It does not attempt to express every possible prop combination, only the ones that
 * are likely to be useful to a developer.
 *
 * Composite examples that nest components inside each other (the carousel)
 * stay hand-written in tests.astro, otherwise this file would become a mess of
 * nested props and slots.
 */

import type { ComponentProps } from "astro/types";
import EightEightThreeOne from "./components/8831.astro";
import Alert from "./components/alert.astro";
import Badge from "./components/badge.astro";
import Button from "./components/button.astro";
import Card from "./components/card.astro";
import Footer from "./components/footer.astro";
import SideHero from "./components/layout/side-hero.astro";
import { friends } from "./data/friends.ts";
import jessew from "./images/88x31s/jessew.png";
import greg from "./images/greg.jpg";

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
}

export interface StoryGroup {
	/** Unique. Used for the `data-story` hook. */
	id: string;
	title: string;
	description?: string;
	/** Minimum gallery cell width, in rem. Wider components need more. */
	min?: number;
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
	content: Pick<Story, "icon" | "slot"> = {},
): Story => ({ name, component, props, ...content });

const VARIANTS = ["solid", "outline", "ghost", "link"] as const;
const BADGE_VARIANTS = ["solid", "outline", "ghost"] as const;
const TONES = [
	"primary",
	"secondary",
	"destructive",
	"warning",
	"success",
] as const;
const SIZES = ["lg", "default", "sm"] as const;

const BODY =
	"<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>";

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const groups: StoryGroup[] = [
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
			story("no-shadow", Button, { shadow: false }, { slot: "No lift" }),
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
		id: "88x31",
		title: "88x31s",
		min: 10,
		stories: [
			...friends.map((friend) =>
				story(friend.name.toLowerCase(), EightEightThreeOne, {
					image: friend.image,
					url: friend.href,
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
				"no-shadow",
				Card,
				{ shadow: false },
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
		min: 36,
		stories: (["right", "left"] as const).map((side) =>
			story(
				side,
				SideHero,
				{ side, image: { url: greg, alt: "Greg Heffley" } },
				{ slot: `<h2>Image on the ${side}</h2>${BODY}` },
			),
		),
	},
	{
		id: "footer",
		title: "Footer",
		min: 36,
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
						url: "https://github.com/cpluspatch",
						icon: "logos:github-icon",
					},
					{
						name: "Twitter",
						url: "https://twitter.com/grok",
						icon: "logos:twitter",
					},
				],
				eightyEightThirtyOne: {
					image: jessew,
					title: "Hotlinking allowed, alt text included for accessibility.",
					alt: "A cool badge with a cool description.",
				},
				friends,
			}),
		],
	},
];
