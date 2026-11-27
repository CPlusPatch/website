// Loaded through Vite's ssrLoadModule (see parity.ts), which compiles the .astro and .svelte imports.
import AstroBadge from "@cpluspatch/ui/astro/ui/badge.astro";
import AstroButton from "@cpluspatch/ui/astro/ui/button.astro";
import AstroSegmentedControl from "@cpluspatch/ui/astro/ui/segmented-control.astro";
import AstroSelect from "@cpluspatch/ui/astro/ui/select.astro";
import AstroToggle from "@cpluspatch/ui/astro/ui/toggle.astro";
import SvelteIcon from "@cpluspatch/ui/svelte/icon.svelte";
import SvelteBadge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import SvelteButton from "@cpluspatch/ui/svelte/ui/button.svelte";
import SvelteSegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import SvelteSelect from "@cpluspatch/ui/svelte/ui/select.svelte";
import SvelteToggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { Component } from "svelte";
import { render } from "svelte/server";
import { isIconName } from "../../packages/ui/src/icons.ts";
import { groups } from "../../src/gallery/stories/index.ts";
import type { Story } from "../../src/gallery/story.ts";
import StoryNode from "../../src/gallery/story-node.astro";
import StorySlot from "../../src/gallery/story-slot.astro";
import type { RenderedCase } from "./types.ts";
import WithChildren from "./with-children.svelte";

type Port = Component<Record<string, unknown>>;

// Each port types its own props, which don't fit a map of any component's.
const port = (component: unknown): Port => component as Port;

// Icon has no stories of its own: the segmented control draws it.
const PORTS = new Map<Story["component"], Port>([
    [AstroBadge, port(SvelteBadge)],
    [AstroButton, port(SvelteButton)],
    [AstroSegmentedControl, port(SvelteSegmentedControl)],
    [AstroSelect, port(SvelteSelect)],
    [AstroToggle, port(SvelteToggle)],
]);

/** `icon` values in a story's props, which the Svelte icon only draws if built in. */
const icons = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(icons);
    if (typeof value !== "object" || value === null) return [];

    return Object.entries(value).flatMap(([key, child]) =>
        key === "icon" && typeof child === "string" ? [child] : icons(child),
    );
};

/** Each story with a port, nested ones too, named by their path of story names. */
const walk = (story: Story, path: string): [string, Story, Port][] => {
    const found = PORTS.get(story.component);
    const nested = [
        ...(story.children ?? []),
        ...Object.values(story.slots ?? {}).flat(),
    ];

    return [
        ...(found ? [[path, story, found] as [string, Story, Port]] : []),
        ...nested.flatMap((child) => walk(child, `${path}/${child.name}`)),
    ];
};

export const renderCases = async (): Promise<RenderedCase[]> => {
    const container = await AstroContainer.create();
    const cases: RenderedCase[] = [];

    for (const group of groups) {
        for (const top of group.stories) {
            for (const [name, story, svelte] of walk(
                top,
                `${group.id}/${top.name}`,
            )) {
                const unsupported = icons(story.props).find(
                    (icon) =>
                        !icon.startsWith("lucide:") ||
                        !isIconName(icon.slice("lucide:".length)),
                );

                // The gallery always gives the component a default slot, even an empty one.
                const html = await container.renderToString(StorySlot, {
                    props: { story },
                });

                cases.push({
                    name,
                    astro: await container.renderToString(StoryNode, {
                        props: { story },
                    }),
                    svelte: unsupported
                        ? ""
                        : render(WithChildren, {
                              props: {
                                  component: svelte,
                                  props: story.props,
                                  html,
                              },
                          }).body,
                    skip: unsupported
                        ? `uses ${unsupported}, which the Svelte icon doesn't draw`
                        : undefined,
                });
            }
        }
    }

    return cases;
};

/** For the test of the icon's guard. */
export const renderSvelteIcon = (name: string): string =>
    render(SvelteIcon, { props: { name: name as `lucide:x` } }).body;
