import { j2000sToUnixMs } from "@cpluspatch/orbit";
import { type Clock, RATES } from "./clock.ts";
import type { PartName } from "./date-parts.ts";

const RATE_WORDS = ["sec", "min", "hour", "day", "week", "month", "year"];

/** The preset's text by magnitude, like `1 day/s`, with a true minus when reversed. */
export const rateText = (rate: number): string => {
    const speed = Math.abs(rate);
    const k = RATES.findLastIndex((preset) => speed >= preset);

    return `${rate < 0 ? "−" : ""}1 ${RATE_WORDS[Math.max(k, 0)]}/s`;
};

/** How close to now, in seconds, a running clock at 1 sec/s counts as live. */
const LIVE_WITHIN_S = 1.5;

/** Whether the clock shows the real time at the real rate. `nowT` is now in seconds since J2000. */
export const isLive = (
    clock: Pick<Clock, "t" | "rate" | "paused">,
    nowT: number,
): boolean =>
    !clock.paused &&
    clock.rate === 1 &&
    Math.abs(clock.t - nowT) < LIVE_WITHIN_S;

/** How far the clock is from now, in full and in its largest unit. */
export type Offset = {
    full: string;
    short: string;
    word: "ahead" | "behind";
};

/** The offset of the clock from now in seconds as text, or `null` under a minute either way. */
export const offsetText = (offsetS: number): Offset | null => {
    const secs = Math.abs(offsetS);
    if (!(secs >= 60)) return null;

    // Whole seconds, so a float can't turn 3h 05m into 3h 04m.
    const y = Math.floor(secs / 31557600);
    const d = Math.floor((secs - y * 31557600) / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const word = offsetS > 0 ? "ahead" : "behind";

    if (y) {
        return { full: d ? `${y}y ${d}d` : `${y}y`, short: `${y}y`, word };
    }
    if (d) return { full: `${d}d ${h}h`, short: `${d}d`, word };
    if (h) {
        return {
            full: `${h}h ${String(m).padStart(2, "0")}m`,
            short: `${h}h`,
            word,
        };
    }

    return { full: `${m}m`, short: `${m}m`, word };
};

/** One part of the date as text, and whether it changes too fast to read. */
export type StampPart = { text: string; fast: boolean };

/** The seconds in a year, month, day, hour, minute and second. */
const UNIT_SECONDS: Record<PartName, number> = {
    y: 31557600,
    mo: 2629800,
    d: 86400,
    h: 3600,
    mi: 60,
    s: 1,
};

/** How fast a part has to change, per second, to count as fast. */
const FAST_PER_S = 2;

const pad = (n: number, width: number): string =>
    String(n).padStart(width, "0");

/** The parts of a time as text, each with whether it changes faster than twice a second at `rate`. */
export const stampParts = (
    t: number,
    rate: number,
): Record<PartName, StampPart> => {
    // Rounds like `toParts`, so the date editor opens on the second shown.
    const date = new Date(Math.round(j2000sToUnixMs(t) / 1000) * 1000);
    const valid = !Number.isNaN(date.getTime());
    const year = date.getUTCFullYear();
    const text: Record<PartName, string> = valid
        ? {
              y: (year < 0 ? "-" : "") + pad(Math.abs(year), 4),
              mo: pad(date.getUTCMonth() + 1, 2),
              d: pad(date.getUTCDate(), 2),
              h: pad(date.getUTCHours(), 2),
              mi: pad(date.getUTCMinutes(), 2),
              s: pad(date.getUTCSeconds(), 2),
          }
        : { y: "----", mo: "--", d: "--", h: "--", mi: "--", s: "--" };

    const part = (name: PartName): StampPart => ({
        text: text[name],
        fast: valid && Math.abs(rate) / UNIT_SECONDS[name] > FAST_PER_S,
    });

    return {
        y: part("y"),
        mo: part("mo"),
        d: part("d"),
        h: part("h"),
        mi: part("mi"),
        s: part("s"),
    };
};
