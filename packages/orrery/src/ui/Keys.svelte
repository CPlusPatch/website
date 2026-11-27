<script lang="ts">
import { ORBIT_CLASS_COLORS, type RoleKey } from "@cpluspatch/render";
import type { OrbitClass } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import type { Attachment } from "svelte/attachments";
import { TRACKS } from "../audio/music.ts";
import { roleMarker } from "./body-marker.ts";
import { ROLE_LABELS } from "./labels.ts";
import { MOD_KEY } from "./shortcuts.ts";

type Props = {
    /** The panel that holds the card. The button stays where the component is placed. */
    host: HTMLElement | undefined;
};

/** The keys that work, as the keys to press and what they do. */
const KEYS: [keys: string[], what: string][] = [
    [["/"], "Search bodies"],
    [["Space"], "Run or hold"],
    [["[", "]"], "Slower, faster"],
    [["R"], "Reverse"],
    [["L"], "Go live"],
    [["T"], "Set the date"],
    [["U"], "Switch km and AU"],
    [["←", "→"], "Scrub the focused timeline"],
    [["F"], "Focus the picked body"],
    [["Arrows"], "Turn the view"],
    [["+", "−"], "Zoom in, out"],
    [["0"], "Fit the focus"],
    [["C"], "Chase the focus, or stop"],
    [["F1"], "Hide the interface, labels, orbits and icons, or show them"],
    [["Esc"], "Close, or clear the pick"],
    [[MOD_KEY, "Z"], "Undo"],
    [[MOD_KEY, "Shift", "Z"], "Redo"],
];

const ORBIT_CLASSES: [OrbitClass, string][] = [
    ["leo", "Low orbit"],
    ["meo", "Medium orbit"],
    ["geo", "Geostationary"],
    ["heo", "Highly elliptical"],
];

const ROLES = Object.entries(ROLE_LABELS) as [RoleKey, string][];

// No-break spaces keep each label on the line of what it labels.
const CREDITS_BEFORE =
    "Sky: NASA/Goddard Space Flight Center Scientific Visualization Studio, with Gaia data from ESA/Gaia/DPAC. Stars: Yale Bright Star Catalogue. Maps:\u00a0";
const CREDITS_AFTER =
    ". Pluto and Charon:\u00a0NASA/JHUAPL/SwRI. Jupiter's and Saturn's major moons (not Titan), Triton, Phobos, Ceres and Vesta:\u00a0" +
    "USGS Astrogeology and DLR, from NASA (Voyager, Galileo, Cassini, Dawn) and " +
    "ESA (Mars Express) data. Kerbol system:\u00a0Kerbal Space Program, " +
    "\u00a9\u00a0Take-Two Interactive. Satellites:\u00a0CelesTrak (Dr T.S. Kelso). Sounds:\u00a0Kenney (CC0). Music:\u00a0" +
    TRACKS.map(({ title, artist }) => `${title} by ${artist}`).join(", ") +
    ".";

const closeClasses = buttonClasses({
    variant: "ghost",
    tone: "neutral",
    size: "icon-sm",
}).join(" ");

const { host }: Props = $props();

let toggle: HTMLButtonElement | undefined;
let card: HTMLElement | undefined;
let open = $state(false);

// The card sits in the side panel, with the other cards, and the button in the top bar.
const moveTo =
    (panel: HTMLElement | undefined): Attachment<HTMLElement> =>
    (node) => {
        if (!panel) return;

        panel.append(node);

        return () => node.remove();
    };

/** Closes the card. Returns whether it was open. */
export const close = (): boolean => {
    if (!open) return false;

    // Hiding the card would drop focus to <body>.
    const held = card?.contains(document.activeElement) ?? false;
    open = false;
    if (held) toggle?.focus();

    return true;
};
</script>

<!-- biome-ignore format: Whitespace between the elements would be rendered. -->
<button type="button" class="orrery__keys-toggle" aria-label="Keyboard keys" aria-expanded={open} aria-controls="orrery-keys" bind:this={toggle} onclick={() => (open = !open)}><span aria-hidden="true">?</span></button>
<!-- biome-ignore format: Same. -->
<section id="orrery-keys" class="{cardClasses().join(" ")} orrery__keys" aria-labelledby="orrery-keys-title" hidden={!open} bind:this={card} {@attach moveTo(host)}>
    <div class="orrery__inspector-head orrery__inspector-head--panel">
        <h2 class="orrery__panel-title" id="orrery-keys-title">Keys</h2>
        <button type="button" class={closeClasses} aria-label="Close keys" onclick={() => {
    open = false;
    toggle?.focus();
}}>{@html iconSvg("x")}</button>
    </div>
    <div class="orrery__keys-body">
        <dl class="orrery__keys-list">
            {#each KEYS as [keys, what] (what)}
                <!-- biome-ignore format: Same. -->
                <dt>{#each keys as key (key)}<kbd>{key}</kbd>{/each}</dt><dd>{what}</dd>
            {/each}
        </dl>
        <section class="orrery__legend">
            <h3>Satellites</h3>
            <ul>
                {#each ORBIT_CLASSES as [orbit, label] (orbit)}
                    <!-- biome-ignore format: Same. -->
                    <li><span class="orrery__legend-swatch" style:background-color={ORBIT_CLASS_COLORS[orbit]} aria-hidden="true"></span>{label}</li>
                {/each}
            </ul>
            <ul>
                {#each ROLES as [role, label] (role)}
                    <!-- biome-ignore format: Same. -->
                    <li><span class="orrery__legend-icon">{@html roleMarker(role)}</span>{label}</li>
                {/each}
            </ul>
        </section>
        <!-- biome-ignore format: Same. -->
        <p class="orrery__credits">{CREDITS_BEFORE}<a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>{CREDITS_AFTER}</p>
    </div>
</section>

<style>
.orrery__keys-toggle {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    min-block-size: var(--orrery-control);
    align-self: stretch;
    padding: 0;
    color: var(--orrery-text);
    font: 500 var(--orrery-size-sm) / 1 var(--orrery-font-ui);
    cursor: pointer;

    &:hover {
        background-color: var(--orrery-panel-raised);
    }
}

/* The keys card takes the orbit card's place while it's open. */
:global(.orrery__panel--right):has(.orrery__keys:not([hidden]))
> :global(.orrery__inspector) {
    display: none;
}

.orrery__keys {
    align-items: stretch;
    gap: 0;
    max-block-size: 100%;
    overflow: hidden;
    padding: 0;

    &[hidden] {
        display: none;
    }
}

/* One scroll area under the head, so short screens scroll instead of clipping. */
.orrery__keys-body {
    min-block-size: 0;
    overflow: auto;
}

.orrery__keys-list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 10px;
    margin: 0;
    padding: 0 var(--orrery-pad) var(--orrery-pad);
    font-size: var(--orrery-size-sm);

    dt {
        display: flex;
        align-items: flex-start;
        gap: 3px;
    }

    dd {
        margin: 0;
        color: var(--orrery-muted);
    }

    kbd {
        padding: 0 5px;
        border: 1px solid var(--orrery-frame);
        background-color: var(--orrery-panel-raised);
        font: 400 var(--orrery-size-xs) / 1.5 var(--orrery-font-data);
    }
}

.orrery__legend {
    display: grid;
    gap: var(--space-sm);
    margin-inline: var(--orrery-pad);
    padding-block: var(--orrery-pad);
    border-block-start: 1px solid var(--orrery-frame);
    font-size: var(--orrery-size-sm);

    h3 {
        margin: 0;
        font-size: inherit;
    }

    ul {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        margin: 0;
        padding: 0;
        list-style: none;
        color: var(--orrery-muted);
    }

    li {
        display: flex;
        align-items: center;
        gap: 10px;
    }
}

.orrery__legend-swatch,
.orrery__legend-icon {
    flex: none;
    inline-size: 14px;
    block-size: 14px;
}

/* A short stroke, like the orbit lines, so it isn't read as a planet. */
.orrery__legend-swatch {
    block-size: 2px;
    border-radius: 1px;
}

.orrery__legend-icon :global(svg) {
    display: block;
    inline-size: 100%;
    block-size: 100%;
}

.orrery__credits {
    margin: 0;
    padding: 0 var(--orrery-pad) var(--orrery-pad);
    color: var(--orrery-dim);
    font-size: var(--orrery-size-xs);
    line-height: 1.6;

    a {
        /* Keeps the focus ring off the punctuation beside the link. */
        padding-inline: 2px;
        color: var(--orrery-muted);
        text-decoration: underline 1px;
        text-underline-offset: 3px;
        white-space: nowrap;

        /* The site's link hover fills the background with the primary colour. */
        &:hover {
            background: none;
            color: var(--orrery-text);
            text-decoration: underline 1px;
        }

        &:focus-visible {
            border-radius: 2px;
            outline: 2px solid var(--orrery-text);
            outline-offset: 0;
        }
    }
}

@media (max-width: 720px) {
    .orrery__keys-toggle {
        inline-size: var(--control-height-md);
        margin-inline-start: auto;
    }

    .orrery__keys {
        inline-size: 100%;
        max-block-size: min(60dvh, 100%);
    }
}
</style>
