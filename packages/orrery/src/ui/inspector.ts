import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import {
    formatAngle,
    formatDistance,
    formatDuration,
    formatSpeed,
} from "../format.ts";
import { type Readouts, readouts } from "../readouts.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The inspector's element and how to remove it. */
export type Inspector = {
    element: HTMLElement;
    destroy: () => void;
};

/** How often the readouts refresh while the clock runs, in ms. */
const REFRESH_MS = 250;

const FIELDS: [
    label: (parent: string) => string,
    value: (r: Readouts) => string,
][] = [
    [(parent) => `Distance to ${parent}`, (r) => formatDistance(r.distance)],
    [() => "Speed", (r) => formatSpeed(r.speed)],
    [() => "Period", (r) => formatDuration(r.period)],
    [() => "Periapsis altitude", (r) => formatDistance(r.periapsisAltitude)],
    [() => "Apoapsis altitude", (r) => formatDistance(r.apoapsisAltitude)],
    [() => "True anomaly", (r) => formatAngle(r.trueAnomaly)],
];

const capitalize = (text: string): string =>
    text.charAt(0).toUpperCase() + text.slice(1);

/** A card with the selected body's name, kind and live orbit readouts. */
export const createInspector = (
    world: World,
    /** Takes keyboard focus when the inspector hides while it holds it. */
    restoreFocus: (id: string) => void,
): Inspector => {
    const names = new Map(
        world.scenario.bodies.map((body) => [body.id, body.name]),
    );

    const close = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Clear selection",
    });
    close.innerHTML = iconSvg("x");
    close.addEventListener("click", () => world.select(null));

    const title = h("h2", { class: "orrery__inspector-title" });
    const meta = h("p", { class: "orrery__inspector-meta" });
    const list = h("dl", { class: "orrery__readouts" });
    const element = h(
        "section",
        {
            class: `${cardClasses().join(" ")} orrery__inspector`,
            "aria-label": "Selected body",
        },
        h("div", { class: "orrery__inspector-head" }, title, close),
        meta,
        list,
    );
    element.hidden = true;

    let values: HTMLElement[] = [];
    let shown: string | null = null;

    const refresh = () => {
        const id = world.selected;
        if (!id || values.length === 0) return;

        const current = readouts(
            world.scenario,
            id,
            world.states(),
            world.clock.t,
        );
        if (!current) return;

        FIELDS.forEach(([, value], k) => {
            const text = value(current);
            const cell = values[k];
            if (cell && cell.textContent !== text) cell.textContent = text;
        });
    };

    const render = () => {
        const id = world.selected;
        const body = world.scenario.bodies.find((b) => b.id === id);
        // Hiding the focused close button would drop focus to <body>.
        if (!body && shown && element.contains(document.activeElement)) {
            restoreFocus(shown);
        }
        shown = body?.id ?? null;
        element.hidden = !body;
        values = [];
        list.replaceChildren();
        list.hidden = true;
        if (!body) return;

        title.textContent = body.name;
        const parent = body.parent ? names.get(body.parent) : undefined;
        meta.textContent = parent
            ? `${capitalize(body.kind)}, orbits ${parent}`
            : capitalize(body.kind);

        // A body with no parent has no orbit to read.
        if (!parent) return;

        list.hidden = false;
        for (const [label] of FIELDS) {
            const value = h("dd", { class: "orrery__readout" });
            values.push(value);
            list.append(h("dt", {}, label(parent)), value);
        }
        refresh();
    };
    render();

    const off = world.on((event) => {
        if (event.type === "selection") render();
        else if (event.type === "clock") refresh();
    });
    const interval = setInterval(refresh, REFRESH_MS);

    return {
        element,
        destroy: () => {
            off();
            clearInterval(interval);
            element.remove();
        },
    };
};
