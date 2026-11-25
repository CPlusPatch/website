import { AU, wrapAngle } from "@cpluspatch/orbit";
import { type AUnit, aUnit } from "./units.ts";

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

const KM = new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
const AU_VALUE = new Intl.NumberFormat("en", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
});
const MILLION_KM = new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const BILLION_KM = new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const AU_RANGE = new Intl.NumberFormat("en", { maximumSignificantDigits: 4 });
const THREE_SIGNIFICANT = new Intl.NumberFormat("en", {
    minimumSignificantDigits: 3,
    maximumSignificantDigits: 3,
});
const KM_PER_S = unit("kilometer-per-second", 2);
const DEGREE_FORMAT = unit("degree", 1, "narrow");

/**
 * A distance in metres as its number and its unit, like `["6,790", "km"]`, with a true minus sign.
 * `chosen` is the unit the reader picked. Without it, km shows under 0.1 AU and AU from there.
 */
export const distanceParts = (
    m: number,
    chosen: AUnit | null = null,
): [number: string, unit: AUnit] => {
    const shown = chosen ?? aUnit(m);
    const au = m / AU;
    // Three decimals would show a small distance in AU as zero.
    const number =
        shown === "km"
            ? KM.format(m / 1000)
            : au !== 0 && Math.abs(au) < 0.001
              ? au.toExponential(2)
              : AU_VALUE.format(au);

    return [number.replace(/^-/, "\u2212"), shown];
};

/** A distance in metres, as `6,790 km` or `1.000 AU`. See `distanceParts` for the unit. */
export const formatDistance = (
    m: number,
    chosen: AUnit | null = null,
): string => distanceParts(m, chosen).join(" ");

/**
 * A distance in metres for a list row: whole km like `6,790 km`, or AU with up to 4
 * significant digits like `36.32 AU` or `0.000297 AU`.
 */
export const formatRange = (m: number, unit: AUnit): string => {
    const number =
        unit === "km" ? KM.format(m / 1000) : AU_RANGE.format(m / AU);

    return `${number.replace(/^-/, "\u2212")} ${unit}`;
};

/** A short distance in metres for the plate: `0.983 AU`, `4.46B km` from 1e9 km, `146.5M km` from 1e6 km, else `6,790 km`. */
export const formatPlateDistance = (m: number, unit: AUnit): string => {
    if (unit === "AU") return `${AU_VALUE.format(m / AU)} AU`;

    const km = m / 1000;

    // Short forms keep the value inside the plate's legend column.
    // Each tier starts where the one below would round up to 1000.0.
    if (km >= 1e9 - 5e4) return `${BILLION_KM.format(km / 1e9)}B km`;
    if (km >= 1e6 - 50) return `${MILLION_KM.format(km / 1e6)}M km`;
    if (km >= 1e4) return `${MILLION_KM.format(km / 1e3)}k km`;

    return `${KM.format(km)} km`;
};

/** The length of a plate's scale bar as a number: `0.2` AU, `2B`, `20M`, `200k` or `5,000` km. */
export const formatScaleLength = (m: number, unit: AUnit): string => {
    if (unit === "AU") return String(+(m / AU).toPrecision(6));

    const km = m / 1000;

    if (km >= 1e9) return `${+(km / 1e9).toPrecision(6)}B`;
    if (km >= 1e6) return `${+(km / 1e6).toPrecision(6)}M`;
    if (km >= 1e4) return `${+(km / 1e3).toPrecision(6)}k`;

    return KM.format(km);
};

/** The unit one list shares: `chosen`, else the unit of its largest distance (km when empty). */
export const listUnit = (
    distances: readonly number[],
    chosen: AUnit | null,
): AUnit =>
    chosen ?? (distances.length > 0 ? aUnit(Math.max(...distances)) : "km");

/** A speed in m/s, as `7.66 km/s`. */
export const formatSpeed = (mps: number): string => KM_PER_S.format(mps / 1000);

/** A radius in metres, as `6,371 km`, or with 3 significant figures under 100 km, like `6.20 km`. */
export const formatRadius = (m: number): string => {
    const km = m / 1000;

    return `${km >= 100 ? KM.format(km) : THREE_SIGNIFICANT.format(km)} km`;
};

/** A surface gravity in m/s², as `9.82 m/s²` or `0.0570 m/s²`. */
export const formatGravity = (mps2: number): string =>
    `${THREE_SIGNIFICANT.format(mps2)} m/s²`;

/** An escape speed in m/s with 3 significant figures, as `11.2 km/s`, or `11.4 m/s` under 1 km/s. */
export const formatEscapeSpeed = (mps: number): string =>
    mps < 1000
        ? `${THREE_SIGNIFICANT.format(mps)} m/s`
        : `${THREE_SIGNIFICANT.format(mps / 1000)} km/s`;

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** A mass in kg in scientific notation with 3 significant figures, like `5.97 × 10²⁴ kg`. */
export const formatMass = (kg: number): string => {
    const [mantissa = "", exponent = "0"] = kg.toExponential(2).split("e");
    const digits = exponent
        .replace("-", "\u207b")
        .replace("+", "")
        .replace(/\d/g, (digit) => SUPERSCRIPT[Number(digit)] ?? digit);

    return `${mantissa} × 10${digits} kg`;
};

type Duration = [limit: number, size: number, format: Intl.NumberFormat];

const DURATIONS: Duration[] = [
    [2 * 3600, 60, unit("minute", 1)],
    [2 * 86400, 3600, unit("hour", 1)],
    [2 * 31557600, 86400, unit("day", 1)],
];

const YEARS: Duration = [Infinity, 31557600, unit("year", 1)];

/** A duration in seconds in the unit that suits it, like `92.7 min` or `1.9 yrs`. */
export const formatDuration = (s: number): string => {
    const [, size, format] = DURATIONS.find(([limit]) => s < limit) ?? YEARS;

    return format.format(s / size);
};

/** An angle in radians, as degrees like `12.3°`. */
export const formatAngle = (rad: number): string => {
    const degrees = Math.round(((rad * 180) / Math.PI) * 10) / 10;

    // 359.96 rounds up to a full turn.
    return DEGREE_FORMAT.format(degrees % 360);
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

/** The distance of an apsis and its change, in one unit, like `Pe 1.023 AU (+0.050 AU)`. */
export const formatApsisChange = (
    name: string,
    metres: number,
    before: number,
    chosen: AUnit | null,
): string => {
    const [number, unit] = distanceParts(metres, chosen);
    const delta = metres - before;
    const [change] = distanceParts(delta, unit);

    return `${name} ${number} ${unit} (${delta >= 0 ? "+" : ""}${change} ${unit})`;
};

/** The ascending node and its change, like `Node 120.0° (+5.0°)`. */
export const formatNodeChange = (raan: number, before: number): string => {
    let delta = wrapAngle(raan - before);
    if (delta > Math.PI) delta -= 2 * Math.PI;

    return `Node ${formatAngle(raan)} (${delta >= 0 ? "+" : "−"}${formatAngle(Math.abs(delta))})`;
};

/** The inclination and its change, like `Inc 23.4° (+5.1°)`. */
export const formatInclinationChange = (i: number, before: number): string => {
    const delta = i - before;

    return `Inc ${formatAngle(i)} (${delta >= 0 ? "+" : "−"}${formatAngle(Math.abs(delta))})`;
};
