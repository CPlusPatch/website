import type { Placement } from "../geometry/labels.ts";
import type { Entry } from "./entry.ts";

export type LabelStyle = {
    selected: boolean;
    big: boolean;
    hover: boolean;
    count: string;
};

const labelModifiers = ({ selected, big, hover }: LabelStyle): string[] =>
    [
        selected && "orrery__label--selected",
        big && "orrery__label--big",
        hover && "orrery__label--hover",
    ].filter((name) => name !== false);

const labelKey = (style: LabelStyle): string =>
    `${labelModifiers(style).join(" ")}|${style.count}`;

/** The label's anchor, as a CSS2D `center`, for each placement. */
export const CENTERS: Record<Placement, [number, number]> = {
    right: [0, 0.5],
    left: [1, 0.5],
    above: [0.5, 1],
    below: [0.5, 0],
    hidden: [0, 0.5],
};

/** The label styling of a scene's bodies. */
export type Labels = {
    /** Draws the label of `entry` in `style` and measures it, unless it's drawn so already. */
    restyle: (entry: Entry, style: LabelStyle) => void;
    /** Measures every styled label again. */
    measureAll: () => void;
    /** Removes the probe element. */
    dispose: () => void;
};

/** Styles and measures the labels of `entries`, with a probe element in `host`. */
export const createLabels = (host: HTMLElement, entries: Entry[]): Labels => {
    // Measures labels here, since a label has no layout until it's drawn.
    const probe = document.createElement("div");
    const probeName = document.createElement("span");
    probeName.className = "orrery__label-name";
    const probeCount = document.createElement("span");
    probeCount.className = "orrery__label-count";
    probe.append(probeName, probeCount);
    host.append(probe);

    // What each label is drawn as, and its text.
    const styles = new Map<string, LabelStyle>();

    const measure = (entry: Entry, style: LabelStyle) => {
        probe.className = [
            "orrery__label",
            "orrery__label--probe",
            ...labelModifiers(style),
        ].join(" ");
        probeName.textContent = entry.body.name;
        probeCount.textContent = style.count;
        entry.text = { width: probe.offsetWidth, height: probe.offsetHeight };
    };
    const measureAll = () => {
        for (const entry of entries) {
            const style = styles.get(entry.body.id);
            if (style) measure(entry, style);
        }
    };

    // The label's classes and text change its width, so it's measured again with them.
    const restyle = (entry: Entry, style: LabelStyle) => {
        const key = labelKey(style);
        if (key === entry.style) return;

        entry.style = key;
        styles.set(entry.body.id, style);
        const { element } = entry.label;
        element.classList.toggle("orrery__label--selected", style.selected);
        element.classList.toggle("orrery__label--big", style.big);
        element.classList.toggle("orrery__label--hover", style.hover);
        entry.count.textContent = style.count;
        measure(entry, style);
    };

    return { restyle, measureAll, dispose: () => probe.remove() };
};
