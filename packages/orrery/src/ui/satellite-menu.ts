import {
    CURATED_CATALOG_NUMBERS,
    CURATED_NAMES,
    type OrbitClass,
    unixMsToJ2000s,
} from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { SATELLITE_GROUPS, type SatelliteGroup } from "../catalogue.ts";
import {
    GROUP_CLASSES,
    SNAPSHOT_DATE,
    SNAPSHOT_EPOCH,
} from "../catalogue-snapshot.ts";
import type { SavedStorage } from "../persistence.ts";
import { readSatellites, writeSatellites } from "../satellite-settings.ts";
import { SNAPSHOT_WINDOW, snapshotGap } from "../swarm.ts";
import { roleMarker } from "./body-marker.ts";
import { h, setText } from "./dom.ts";
import { attachMenu } from "./menu.ts";

/** What the menu needs from the world clock. */
export type SatelliteClock = {
    /** The clock's time in seconds since J2000. */
    now: () => number;
    goLive: () => void;
};

/** The satellite button, its menu and how to remove them. */
export type SatelliteMenu = {
    element: HTMLElement;
    /** The groups that are on. */
    groups: () => SatelliteGroup[];
    /** Shows or hides the button. Hiding it closes the menu, and the groups stay on. */
    setAvailable: (on: boolean) => void;
    destroy: () => void;
};

const LABELS: Record<SatelliteGroup, string> = {
    starlink: "Starlink",
    oneweb: "OneWeb",
    kuiper: "Kuiper",
    "guowang-qianfan": "Qianfan and Guowang",
    "phone-iot": "Phone and IoT",
    navigation: "Navigation",
    imaging: "Earth imaging",
    weather: "Weather",
    other: "Everything else",
};

/** The snapshot's epoch in seconds since J2000. */
const EPOCH = unixMsToJ2000s(SNAPSHOT_EPOCH);

const CLASSES: readonly OrbitClass[] = ["leo", "meo", "geo", "heo"];

type Counts = Record<OrbitClass, number>;

const sum = (counts: Counts): number =>
    CLASSES.reduce((all, orbit) => all + counts[orbit], 0);

const total = (group: SatelliteGroup): number => sum(GROUP_CLASSES[group]);

const ALL = SATELLITE_GROUPS.reduce((all, group) => all + total(group), 0);

const fmt = (count: number): string => count.toLocaleString("en-GB");

const setSeg = (segment: HTMLElement, count: number): void => {
    segment.style.setProperty("--n", String(count));
    segment.toggleAttribute("data-zero", count === 0);
};

/** A bar segment sized by `count`, which `--n` turns into a flex share. */
const seg = (orbit: OrbitClass | "rest", count: number): HTMLElement => {
    const segment = h("span", {
        class: `orrery__satellite-seg orrery__satellite-seg--${orbit}`,
    });
    setSeg(segment, count);

    return segment;
};

const countEl = (text = ""): HTMLElement =>
    h("span", { class: "orrery__satellite-count" }, text);

/** One orbit class in a legend, with its count when there is one. */
const cell = (orbit: OrbitClass, count?: HTMLElement): HTMLElement =>
    h(
        "span",
        { class: "orrery__satellite-cell" },
        h("i", {
            class: `orrery__satellite-swatch orrery__satellite-seg--${orbit}`,
        }),
        h("span", {}, orbit.toUpperCase()),
        ...(count ? [count] : []),
    );

const present = (counts: Counts): OrbitClass[] =>
    CLASSES.filter((orbit) => counts[orbit] > 0);

/** A single orbit class, which sits on the row's first line. */
const tag = (orbit: OrbitClass): HTMLElement =>
    h(
        "span",
        { class: "orrery__satellite-tag", "aria-hidden": "true" },
        cell(orbit),
    );

/** A split bar and legend for a row with more than one orbit class. */
const detail = (counts: Counts, classes: OrbitClass[]): HTMLElement[] => [
    h(
        "span",
        { class: "orrery__satellite-bar", "aria-hidden": "true" },
        ...classes.map((orbit) => seg(orbit, counts[orbit])),
    ),
    h(
        "span",
        { class: "orrery__satellite-detail", "aria-hidden": "true" },
        ...classes.map((orbit) => cell(orbit, countEl(fmt(counts[orbit])))),
    ),
];

/** The "Shown" row, and how to update it for the groups that are on. */
const createTotalRow = (
    clock: SatelliteClock,
): {
    element: HTMLElement;
    render: (groups: ReadonlySet<SatelliteGroup>) => void;
} => {
    const figure = h("span", { class: "orrery__satellite-figure" });
    const parts = CLASSES.map((orbit) => {
        const count = countEl();

        return { orbit, seg: seg(orbit, 0), count, cell: cell(orbit, count) };
    });
    const rest = seg("rest", 0);

    const note = h("span");
    const goNow = h(
        "button",
        {
            type: "button",
            class: "orrery__satellite-go-now",
            title: "Real time (L)",
            "aria-keyshortcuts": "L",
        },
        "Go to now",
    );

    const element = h(
        "div",
        { class: "orrery__satellite-total-row", role: "status" },
        h(
            "div",
            { class: "orrery__satellite-total-head" },
            h("span", { class: "orrery__satellite-total-name" }, "Shown"),
            // Before "of" so a screen reader says "Shown 14,338 of 16,897".
            figure,
            h("span", { class: "orrery__satellite-of" }, `of ${fmt(ALL)}`),
        ),
        h(
            "div",
            {
                class: "orrery__satellite-bar orrery__satellite-bar--total",
                "aria-hidden": "true",
            },
            ...parts.map((part) => part.seg),
            rest,
        ),
        h(
            "div",
            { class: "orrery__satellite-detail", "aria-hidden": "true" },
            ...parts.map((part) => part.cell),
        ),
        h("div", { class: "orrery__satellite-outside" }, note, goNow),
    );

    let current: ReadonlySet<SatelliteGroup> = new Set();
    const render = (groups: ReadonlySet<SatelliteGroup>) => {
        current = groups;
        const offset = clock.now() - EPOCH;
        const outside = snapshotGap(clock.now(), EPOCH) !== 0;
        element.toggleAttribute("data-outside", outside);
        if (outside) {
            // In window-sized years, so the first moment outside it reads "1 year".
            const years = Math.floor(Math.abs(offset) / SNAPSHOT_WINDOW);
            setText(
                note,
                `The clock is over ${years} ${years === 1 ? "year" : "years"} ${offset > 0 ? "after" : "before"} the snapshot.`,
            );
            setText(figure, "0");

            return;
        }

        let shown = 0;
        for (const part of parts) {
            let count = 0;
            for (const group of groups)
                count += GROUP_CLASSES[group][part.orbit];

            shown += count;
            setText(part.count, fmt(count));
            setSeg(part.seg, count);
            part.cell.toggleAttribute("data-zero", count === 0);
        }

        setText(figure, fmt(shown));
        setSeg(rest, ALL - shown);
    };

    goNow.addEventListener("click", () => {
        clock.goLive();
        render(current);
    });

    return { element, render };
};

const footLines = (): string[] => [
    `Orbits from CelesTrak, ${SNAPSHOT_DATE}. Hidden more than a year before or after.`,
    `${CURATED_NAMES.slice(0, 3).join(", ")} and ${CURATED_CATALOG_NUMBERS.length - 3} others are always shown.`,
];

/** How often the "Shown" row checks the clock while the menu is open. */
const REFRESH_MS = 500;

/** The top bar button that opens the satellite group switches, and the menu itself. */
export const createSatelliteMenu = (
    storage: SavedStorage,
    onChange: (groups: SatelliteGroup[]) => void,
    clock: SatelliteClock,
): SatelliteMenu => {
    const on = new Set(readSatellites(storage));

    const toolIcon = h("span", { class: "orrery__tool-icon" });
    toolIcon.innerHTML = roleMarker("other");
    const button = h(
        "button",
        {
            type: "button",
            class: "orrery__tool",
            "aria-haspopup": "menu",
            "aria-expanded": "false",
            "aria-controls": "orrery-satellite-menu",
        },
        toolIcon,
        h("span", { class: "orrery__tool-label" }, "Satellites"),
    );

    const totalRow = createTotalRow(clock);

    const items = SATELLITE_GROUPS.map((group) => {
        const classes = present(GROUP_CLASSES[group]);
        const [only] = classes;
        const entry = h(
            "button",
            {
                type: "button",
                class: "orrery__satellite-item",
                role: "menuitemcheckbox",
                "aria-checked": String(on.has(group)),
                "aria-label": `${LABELS[group]}, ${fmt(total(group))}`,
                tabindex: "-1",
            },
            h(
                "span",
                { class: "orrery__satellite-margin" },
                h("span", { class: "orrery__satellite-mark" }),
            ),
            h("span", { class: "orrery__satellite-label" }, LABELS[group]),
            ...(classes.length === 1 && only ? [tag(only)] : []),
            h("span", { class: "orrery__satellite-total" }, fmt(total(group))),
            ...(classes.length > 1
                ? detail(GROUP_CLASSES[group], classes)
                : []),
        );
        entry
            .querySelector(".orrery__satellite-mark")
            ?.insertAdjacentHTML("afterbegin", iconSvg("check"));
        entry.addEventListener("click", () => {
            if (on.has(group)) on.delete(group);
            else on.add(group);
            entry.setAttribute("aria-checked", String(on.has(group)));
            totalRow.render(on);

            const groups = list();
            writeSatellites(storage, groups);
            onChange(groups);
        });

        return entry;
    });
    totalRow.render(on);

    // In the order of `SATELLITE_GROUPS`, whatever order they were switched on in.
    const list = () => SATELLITE_GROUPS.filter((group) => on.has(group));

    const menu = h(
        "div",
        {
            id: "orrery-satellite-menu",
            role: "menu",
            "aria-label": "Satellites",
            "aria-describedby": "orrery-satellite-foot",
        },
        ...items,
    );
    const foot = h(
        "div",
        { id: "orrery-satellite-foot" },
        ...footLines().map((line) =>
            h("p", { class: "orrery__satellite-foot" }, line),
        ),
    );
    const popup = h(
        "div",
        { class: "orrery__satellite-menu" },
        menu,
        totalRow.element,
        foot,
    );
    const element = h("div", { class: "orrery__satellites" }, button, popup);

    // The clock moves while the menu is open, so the "Shown" row polls it.
    let refresh: ReturnType<typeof setInterval> | undefined;
    const stopRefresh = () => {
        clearInterval(refresh);
        refresh = undefined;
    };
    const control = attachMenu({
        button,
        popup,
        menu,
        items,
        onToggle: (open) => {
            stopRefresh();
            if (!open) return;

            totalRow.render(on);
            refresh = setInterval(() => totalRow.render(on), REFRESH_MS);
        },
    });

    return {
        element,
        groups: list,
        setAvailable: (available) => {
            element.hidden = !available;
            if (!available) control.close(false);
        },
        destroy: () => {
            stopRefresh();
            control.destroy();
            element.remove();
        },
    };
};
