import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { TRACKS } from "../audio/music.ts";
import { h } from "./dom.ts";

/** The keys card, the button that opens it and how to remove them. */
export type Keys = {
    toggle: HTMLButtonElement;
    card: HTMLElement;
    /** Closes the card. Returns whether it was open. */
    close: () => boolean;
    destroy: () => void;
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
    [["Esc"], "Close, or clear the pick"],
];

/** A card that lists the keyboard shortcuts, and the "?" button that toggles it. */
export const createKeys = (): Keys => {
    const toggle = h(
        "button",
        {
            type: "button",
            class: "orrery__keys-toggle",
            "aria-label": "Keyboard keys",
            "aria-expanded": "false",
            "aria-controls": "orrery-keys",
        },
        h("span", { "aria-hidden": "true" }, "?"),
    );

    const closeButton = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Close keys",
    });
    closeButton.innerHTML = iconSvg("x");

    const card = h(
        "section",
        {
            id: "orrery-keys",
            class: `${cardClasses().join(" ")} orrery__keys`,
            "aria-labelledby": "orrery-keys-title",
        },
        h(
            "div",
            { class: "orrery__inspector-head orrery__inspector-head--panel" },
            h(
                "h2",
                { class: "orrery__panel-title", id: "orrery-keys-title" },
                "Keys",
            ),
            closeButton,
        ),
        h(
            "dl",
            { class: "orrery__keys-list" },
            ...KEYS.flatMap(([keys, what]) => [
                h("dt", {}, ...keys.map((key) => h("kbd", {}, key))),
                h("dd", {}, what),
            ]),
        ),
        h(
            "p",
            { class: "orrery__credits" },
            // No-break spaces keep each label on the line of what it labels.
            "Sky: NASA/Goddard Space Flight Center Scientific Visualization Studio, with Gaia data from ESA/Gaia/DPAC. Stars: Yale Bright Star Catalogue. Maps:\u00a0",
            h(
                "a",
                { href: "https://www.solarsystemscope.com/textures/" },
                "Solar System Scope",
            ),
            ", ",
            h(
                "a",
                { href: "https://creativecommons.org/licenses/by/4.0/" },
                "CC BY 4.0",
            ),
            ". Pluto and Charon:\u00a0NASA/JHUAPL/SwRI. Jupiter's and Saturn's major moons (not Titan), Triton, Phobos, Ceres and Vesta:\u00a0" +
                "USGS Astrogeology and DLR, from NASA (Voyager, Galileo, Cassini, Dawn) and " +
                "ESA (Mars Express) data. Kerbol system:\u00a0Kerbal Space Program, " +
                "\u00a9\u00a0Take-Two Interactive. Sounds:\u00a0Kenney (CC0). Music:\u00a0" +
                TRACKS.map(({ title, artist }) => `${title} by ${artist}`).join(
                    ", ",
                ) +
                ".",
        ),
    );
    card.hidden = true;

    const show = (open: boolean) => {
        card.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
    };

    const onToggle = () => show(Boolean(card.hidden));
    const onClose = () => {
        show(false);
        toggle.focus();
    };
    toggle.addEventListener("click", onToggle);
    closeButton.addEventListener("click", onClose);

    return {
        toggle,
        card,
        close: () => {
            if (card.hidden) return false;

            // Hiding the card would drop focus to <body>.
            const held = card.contains(document.activeElement);
            show(false);
            if (held) toggle.focus();

            return true;
        },
        destroy: () => {
            toggle.removeEventListener("click", onToggle);
            closeButton.removeEventListener("click", onClose);
            toggle.remove();
            card.remove();
        },
    };
};
