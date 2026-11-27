import { dateText, formatSpeed, stampParts } from "@cpluspatch/render";
import {
    type Document,
    expandPresets,
    type Presets,
    segmentsByBody,
    type TimelineEvent,
} from "@cpluspatch/sim";
import { failureMessage } from "../../burning.ts";

/** One timeline event of a body, as the card lists it. */
export type ManeuverRow = {
    id: string;
    t: number;
    /** The UTC date and time to the minute. */
    when: string;
    what: string;
    /** The speed of a burn without its unit, like `1.24`. Empty for an orbit set. */
    amount: string;
    /** The unit of `amount`, like `km/s`. Empty for an orbit set. */
    unit: string;
    /** The offset from the clock, like `in 3 mo 5 d`, `6 d 15 h ago` or `now`. */
    ago: string;
    /** Whether the event is at or before the clock. */
    past: boolean;
    kind: TimelineEvent["type"];
};

const whenText = (t: number): string => {
    const { h, mi } = stampParts(t, 0);

    return `${dateText(t)} ${h.text}:${mi.text} UTC`;
};

// Fixed lengths in seconds, largest first.
const UNITS = [
    ["y", 365.25 * 86400],
    ["mo", 30.4375 * 86400],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
] as const;

/** The offset from `now` to `t`: the largest unit with the next one down, floored, or `now`. */
const agoText = (t: number, now: number): string => {
    let rest = Math.abs(t - now);
    const counts = UNITS.map(([, length]) => {
        const count = Math.floor(rest / length);
        rest -= count * length;

        return count;
    });
    const first = counts.findIndex((count) => count > 0);
    if (first === -1) return "now";

    const parts = [first, first + 1]
        .filter((i) => i < UNITS.length && (i === first || counts[i]))
        .map((i) => `${counts[i]} ${UNITS[i]?.[0]}`)
        .join(" ");

    return t > now ? `in ${parts}` : `${parts} ago`;
};

/** A speed like `1.24 km/s` as its number and its unit. */
const splitSpeed = (text: string): [string, string] => {
    if (text === "") return ["", ""];

    const match = /^(.*)\s(\S+)$/u.exec(text);

    return [match?.[1] ?? text, match?.[2] ?? ""];
};

/** The index of the first row that isn't past, or `rows.length` when all are. */
export const firstUpcoming = (rows: readonly ManeuverRow[]): number => {
    const index = rows.findIndex((row) => !row.past);

    return index === -1 ? rows.length : index;
};

/** The events of body `bodyId` in time order. `now` is the clock in seconds since J2000. */
export const maneuverRows = (
    timeline: readonly TimelineEvent[],
    bodyId: string,
    now: number,
): ManeuverRow[] =>
    timeline
        .filter((event) => event.bodyId === bodyId)
        .toSorted((a, b) => a.t - b.t)
        .map((event) => {
            const speed =
                event.type === "burn"
                    ? formatSpeed(
                          Math.hypot(
                              event.dv.prograde,
                              event.dv.normal,
                              event.dv.radial,
                          ),
                      )
                    : "";
            const [amount, unit] = splitSpeed(speed);

            return {
                id: event.id,
                t: event.t,
                when: whenText(event.t),
                what: event.type === "burn" ? `Δv ${speed}` : "Orbit set",
                amount,
                unit,
                ago: agoText(event.t, now),
                past: event.t <= now,
                kind: event.type,
            };
        });

/** What a remove button's event is called in a sentence. */
const kindText = (kind: TimelineEvent["type"]): string =>
    kind === "burn" ? "burn" : "orbit set";

/** The accessible name of the button that removes `row`. */
export const removeLabel = (row: Pick<ManeuverRow, "kind" | "when">): string =>
    `Remove ${kindText(row.kind)} at ${row.when}`;

/** What a screen reader hears once `row` is removed. */
export const removedMessage = (
    row: Pick<ManeuverRow, "kind" | "when">,
): string => `Removed the ${kindText(row.kind)} at ${row.when}.`;

/**
 * Why `doc` is invalid without event `eventId`, or null when it's valid. The reason is the first
 * burn that fails once the event is gone.
 */
export const rejectedRemove = (
    doc: Document,
    eventId: string,
    presets: Presets,
): string | null => {
    const timeline = doc.timeline.filter((event) => event.id !== eventId);
    const bodies = expandPresets(doc.scenario, presets).bodies;
    const result = segmentsByBody(bodies, timeline);
    const failure = result.ok ? undefined : result.failures[0];
    if (!failure) return null;

    const body = bodies.find((candidate) => candidate.id === failure.bodyId);
    const parentId = body && "orbit" in body ? body.orbit?.parent : undefined;
    const parent = bodies.find((candidate) => candidate.id === parentId);
    const reason = failureMessage(
        failure.reason,
        parent?.name ?? "its parent",
        body?.name ?? failure.bodyId,
    );

    return `Removing this makes the burn at ${whenText(failure.t)} fail. ${reason} Remove that burn first.`;
};
