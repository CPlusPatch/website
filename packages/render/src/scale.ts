import { AU } from "@cpluspatch/orbit";
import { type AUnit, aUnit } from "./units.ts";

const AU_KM = AU / 1000;
const COUNT = new Intl.NumberFormat("en", { maximumFractionDigits: 20 });

/** The km one CSS pixel spans at `distanceKm` from the camera, for a view `heightPx` tall. */
export const kmPerPx = (
    distanceKm: number,
    fovRad: number,
    heightPx: number,
): number => (2 * distanceKm * Math.tan(fovRad / 2)) / heightPx;

// Whole numbers read as "million" from 1e7 and "billion" from 1e9, so long bars stay short.
const kmLabel = (km: number): string => {
    if (km >= 1e9) return `${COUNT.format(km / 1e9)} billion km`;
    if (km >= 1e7) return `${COUNT.format(km / 1e6)} million km`;

    return `${COUNT.format(km)} km`;
};

/**
 * A scale bar about `targetPx` long: its length in px and its label, like `"6,000 km"`.
 * The length is the largest of 1, 2 and 5 times a power of ten that is at least 0.6 of the target.
 * `chosen` is the unit the reader picked. Without it, km shows under 0.1 AU and AU from there.
 */
export const scaleBar = (
    kmPerPixel: number,
    targetPx: number,
    chosen: AUnit | null,
): { px: number; label: string } => {
    const target = kmPerPixel * targetPx;
    const unit = chosen ?? aUnit(target * 1000);
    const value = unit === "km" ? target : target / AU_KM;
    const power = 10 ** Math.floor(Math.log10(value));
    const nice = [1, 2, 5, 10].find((m) => m * power >= value * 0.6);
    // The list ends at 10, which always satisfies the test.
    const length = (nice ?? 10) * power;

    return {
        px: (unit === "km" ? length : length * AU_KM) / kmPerPixel,
        label: unit === "km" ? kmLabel(length) : `${COUNT.format(length)} AU`,
    };
};
