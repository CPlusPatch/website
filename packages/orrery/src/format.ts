import { AU } from "@cpluspatch/orbit";

// A fixed locale keeps every reader's text, and the readouts' widths, the same.
const unit = (
    name: string,
    digits: number,
    unitDisplay: "short" | "long" | "narrow" = "short",
): Intl.NumberFormat =>
    new Intl.NumberFormat("en", {
        style: "unit",
        unit: name,
        unitDisplay,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const KM = unit("kilometer", 0);
const AU_VALUE = new Intl.NumberFormat("en", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
});
const KM_PER_S = unit("kilometer-per-second", 2);
const DEGREES = unit("degree", 1, "narrow");

/** A distance in metres, as `6,790 km` or, from 0.1 AU, `1.000 AU`, with a true minus sign. */
export const formatDistance = (m: number): string =>
    (m < 0.1 * AU
        ? KM.format(m / 1000)
        : `${AU_VALUE.format(m / AU)} AU`
    ).replace(/^-/, "\u2212");

/** A speed in m/s, as `7.66 km/s`. */
export const formatSpeed = (mps: number): string => KM_PER_S.format(mps / 1000);

const DURATIONS: [limit: number, size: number, format: Intl.NumberFormat][] = [
    [2 * 3600, 60, unit("minute", 1)],
    [2 * 86400, 3600, unit("hour", 1)],
    [2 * 31557600, 86400, unit("day", 1)],
    [Infinity, 31557600, unit("year", 1)],
];

/** A duration in seconds in the unit that suits it, like `92.7 min` or `1.9 yrs`. */
export const formatDuration = (s: number): string => {
    const [, size, format] =
        DURATIONS.find(([limit]) => s < limit) ?? DURATIONS[3];

    return format.format(s / size);
};

/** An angle in radians, as degrees like `12.3°`. */
export const formatAngle = (rad: number): string => {
    const degrees = Math.round(((rad * 180) / Math.PI) * 10) / 10;

    // 359.96 rounds up to a full turn.
    return DEGREES.format(degrees % 360);
};

const SHORT_YEARS = new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

/** A time span in seconds in one short unit, like `41d`, `3h`, `12m` or `1.2y`. */
export const formatSoon = (s: number): string => {
    // Each unit rounds first, so 59.5 minutes reads "1h" and not "60m".
    const minutes = Math.round(Math.max(0, s) / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.round(s / 3600);
    if (hours < 24) return `${hours}h`;

    const days = Math.round(s / 86400);
    if (days < 365) return `${days}d`;

    return `${SHORT_YEARS.format(s / 31557600)}y`;
};
