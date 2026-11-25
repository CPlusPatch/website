import { AU } from "@cpluspatch/orbit";

/** The unit a semi-major axis is shown in. */
export type AUnit = "km" | "AU";

/** Degrees in a radian. */
export const DEGREES = 180 / Math.PI;

/** The unit a semi-major axis of `a` metres is shown in: km under 0.1 AU. */
export const aUnit = (a: number): AUnit => (a < 0.1 * AU ? "km" : "AU");

/** A distance in metres in `unit`. */
export const fromMetres = (m: number, unit: AUnit): number =>
    unit === "km" ? m / 1000 : m / AU;

/** A distance in `unit` in metres. */
export const toMetres = (x: number, unit: AUnit): number =>
    unit === "km" ? x * 1000 : x * AU;

/** The other unit of the pair. */
export const otherUnit = (unit: AUnit): AUnit => (unit === "km" ? "AU" : "km");

/** The distance unit a reader chose, or `null` while each distance picks its own. */
export type Units = {
    get: () => AUnit | null;
    /** Sets the choice and tells the listeners if it changed. */
    set: (unit: AUnit | null) => void;
    /** Calls `listener` when the choice changes. Returns a function that stops it. */
    subscribe: (listener: () => void) => () => void;
    /** Picks the other unit from the one in use, or from `shown` while none is chosen. */
    toggle: (shown: AUnit) => void;
};

/** A store for the chosen distance unit. */
export const createUnits = (): Units => {
    let choice: AUnit | null = null;
    const listeners = new Set<() => void>();

    const set = (unit: AUnit | null) => {
        if (unit === choice) return;

        choice = unit;
        for (const listener of [...listeners]) listener();
    };

    return {
        get: () => choice,
        set,
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        toggle: (shown) => set(otherUnit(choice ?? shown)),
    };
};
