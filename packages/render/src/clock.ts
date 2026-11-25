/** Simulated seconds per real second, from slowest to fastest. */
export const RATES = [
    1, // 1 second
    60, // 1 minute
    3600, // 1 hour
    86400, // 1 day
    604800, // 1 week
    2629800, // 1 month (a twelfth of a Julian year)
    31557600, // 1 year (Julian, 365.25 days)
];

/** The index in `RATES` of the preset a rate snaps to, by magnitude. */
export const presetOf = (rate: number): number =>
    Math.max(
        RATES.findLastIndex((preset) => Math.abs(rate) >= preset),
        0,
    );

/** One day per second. */
export const DEFAULT_RATE = 86400;

/** The simulated time and how fast it runs. */
export class Clock {
    /** Seconds since J2000. */
    t: number;
    /** Simulated seconds per real second. Negative runs backwards. */
    rate: number;
    paused: boolean;

    constructor(t: number, rate: number, paused: boolean) {
        this.t = t;
        this.rate = rate;
        this.paused = paused;
    }

    /** Advances the time by `dtReal` real seconds, unless paused. */
    tick(dtReal: number): void {
        if (!this.paused) this.t += this.rate * dtReal;
    }

    set(t: number): void {
        this.t = t;
    }
}

/** The next or previous preset by magnitude, keeping the sign of `rate`. */
export const stepRate = (rate: number, direction: -1 | 1): number => {
    const sign = rate < 0 ? -1 : 1;
    const speed = Math.abs(rate);
    const first = RATES[0] ?? speed;
    const last = RATES[RATES.length - 1] ?? speed;

    const next =
        direction === 1
            ? (RATES.find((preset) => preset > speed) ?? last)
            : (RATES.findLast((preset) => preset < speed) ?? first);

    return sign * next;
};
