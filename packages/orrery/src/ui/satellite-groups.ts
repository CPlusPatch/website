import { CURATED_CATALOG_NUMBERS, CURATED_NAMES } from "@cpluspatch/catalog";
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import {
    type OrbitClass,
    SATELLITE_GROUPS,
    type SatelliteGroup,
    SNAPSHOT_WINDOW,
    snapshotGap,
} from "@cpluspatch/sim";
import {
    GROUP_CLASSES,
    SNAPSHOT_DATE,
    SNAPSHOT_EPOCH,
} from "../catalogue-snapshot.ts";

/** The name of each satellite group in the menu. */
export const LABELS: Record<SatelliteGroup, string> = {
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
export const EPOCH = unixMsToJ2000s(SNAPSHOT_EPOCH);

/** The orbit classes, in the order the legends list them. */
export const CLASSES: readonly OrbitClass[] = ["leo", "meo", "geo", "heo"];

/** A number of satellites for each orbit class. */
export type Counts = Record<OrbitClass, number>;

const sum = (counts: Counts): number =>
    CLASSES.reduce((all, orbit) => all + counts[orbit], 0);

/** The satellites in `group`. */
export const total = (group: SatelliteGroup): number =>
    sum(GROUP_CLASSES[group]);

/** The satellites in every group. */
export const ALL: number = SATELLITE_GROUPS.reduce(
    (all, group) => all + total(group),
    0,
);

/** `count` with thousands separators. */
export const fmt = (count: number): string => count.toLocaleString("en-GB");

/** The orbit classes in `counts` that have satellites. */
export const present = (counts: Counts): OrbitClass[] =>
    CLASSES.filter((orbit) => counts[orbit] > 0);

/** The name of `group`'s menu item, which says how many satellites it holds. */
export const itemLabel = (group: SatelliteGroup): string =>
    `${LABELS[group]}, ${fmt(total(group))}`;

/** What the "Shown" row counts for the groups that are on. */
export type ShownCounts = {
    counts: Counts;
    shown: number;
    /** The satellites that are hidden. */
    rest: number;
};

/** The satellites in `groups`, by orbit class. */
export const shownCounts = (groups: Iterable<SatelliteGroup>): ShownCounts => {
    const counts: Counts = { leo: 0, meo: 0, geo: 0, heo: 0 };
    for (const group of groups) {
        for (const orbit of CLASSES)
            counts[orbit] += GROUP_CLASSES[group][orbit];
    }
    const shown = sum(counts);

    return { counts, shown, rest: ALL - shown };
};

/** Why nothing is shown at clock time `now`, or `null` while it's inside the snapshot's window. */
export const outsideNote = (now: number): string | null => {
    if (snapshotGap(now, EPOCH) === 0) return null;

    const offset = now - EPOCH;
    // In window-sized years, so the first moment outside it reads "1 year".
    const years = Math.floor(Math.abs(offset) / SNAPSHOT_WINDOW);

    return `The clock is over ${years} ${years === 1 ? "year" : "years"} ${offset > 0 ? "after" : "before"} the snapshot.`;
};

/** The two lines under the "Shown" row. */
export const footLines = (): string[] => [
    `Orbits from CelesTrak, ${SNAPSHOT_DATE}. Hidden more than a year before or after.`,
    `${CURATED_NAMES.slice(0, 3).join(", ")} and ${CURATED_CATALOG_NUMBERS.length - 3} others are always shown.`,
];
