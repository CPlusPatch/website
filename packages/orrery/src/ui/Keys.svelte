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
