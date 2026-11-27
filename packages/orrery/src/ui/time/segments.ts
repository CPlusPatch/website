import {
    type DateParts,
    formatYear,
    PART_NAMES,
    type PartName,
} from "@cpluspatch/render";

/** What each part is called, and how many digits it takes. The year may also have a leading minus. */
export const SEGMENTS: Record<PartName, { label: string; digits: number }> = {
    y: { label: "Year", digits: 4 },
    mo: { label: "Month", digits: 2 },
    d: { label: "Day", digits: 2 },
    h: { label: "Hour", digits: 2 },
    mi: { label: "Minute", digits: 2 },
    s: { label: "Second", digits: 2 },
};

/** Keys that move on to the next part, as they do when typing a date. */
const NEXT_KEYS = ["-", ":", " ", "/"];

/** An input's text and its selection. */
export type Field = {
    value: string;
    start: number | null;
    end: number | null;
};

/** What a key does in a part: step it up or down, or move to the part before or after. */
export type SegmentAction = "up" | "down" | "before" | "after";

// A minus at the start of the year is a sign, not a separator.
const isSign = (key: string, name: PartName, field: Field): boolean =>
    key === "-" &&
    name === "y" &&
    field.start === 0 &&
    (field.end !== 0 || !field.value.startsWith("-"));

/** The action for `key` in part `name`, or `null` to leave the key to the input. */
export const segmentAction = (
    key: string,
    name: PartName,
    field: Field,
): SegmentAction | null => {
    const at = PART_NAMES.indexOf(name);
    const first = at === 0;
    const last = at === PART_NAMES.length - 1;

    if (key === "ArrowUp") return "up";
    if (key === "ArrowDown") return "down";
    if (key === "ArrowLeft" && field.start === 0 && !first) return "before";
    if (key === "ArrowRight" && field.end === field.value.length && !last) {
        return "after";
    }
    if (key === "Backspace" && field.value === "" && !first) return "before";
    if (NEXT_KEYS.includes(key) && !last && !isSign(key, name, field)) {
        return "after";
    }

    return null;
};

/** `value` without what the part can't hold. */
export const cleanSegment = (name: PartName, value: string): string =>
    value.replace(name === "y" ? /(?!^)-|[^\d-]/g : /\D/g, "");

/** Whether the part has all its digits, so the focus can move on. */
export const isFull = (name: PartName, value: string): boolean =>
    value.replace("-", "").length === SEGMENTS[name].digits;

/** The part's number, or `NaN` when its text isn't one. */
export const segmentNumber = (name: PartName, value: string): number =>
    (name === "y" ? /^-?\d+$/ : /^\d+$/).test(value)
        ? Number(value)
        : Number.NaN;

/** The part `by` places from `name`, or `name` itself at either end. */
export const partBeside = (name: PartName, by: -1 | 1): PartName =>
    PART_NAMES[PART_NAMES.indexOf(name) + by] ?? name;

/** The text a part shows for `value`: the year as it is, the rest padded with zeros. */
export const partText = (name: PartName, value: number): string =>
    name === "y"
        ? formatYear(value)
        : String(value).padStart(SEGMENTS[name].digits, "0");

/** The parts that `textOf` gives the text of, each read with `segmentNumber`. */
export const readParts = (textOf: (name: PartName) => string): DateParts => {
    const number = (name: PartName) => segmentNumber(name, textOf(name));

    return {
        y: number("y"),
        mo: number("mo"),
        d: number("d"),
        h: number("h"),
        mi: number("mi"),
        s: number("s"),
    };
};

/** Whether the focus moves to the next part after typing `value`: the part is full, and not the last. */
export const movesOn = (name: PartName, value: string): boolean =>
    isFull(name, value) && name !== PART_NAMES.at(-1);
