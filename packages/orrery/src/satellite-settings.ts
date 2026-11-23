import { SATELLITE_GROUPS, type SatelliteGroup } from "./catalogue.ts";
import type { SavedStorage } from "./persistence.ts";

/** The `localStorage` key of the satellite groups that are on. */
export const SATELLITES_KEY = "orrery:satellites:v1";

/** The saved groups that are on, or none if they're missing, bad or unreadable. */
export const readSatellites = (storage: SavedStorage): SatelliteGroup[] => {
    try {
        const raw = storage.getItem(SATELLITES_KEY);
        if (raw === null) return [];

        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value)) {
            // Unknown names are dropped, so a group renamed later doesn't break the read.
            return SATELLITE_GROUPS.filter((group) => value.includes(group));
        }
    } catch {
        // Falls through to the default.
    }

    return [];
};

/** Saves the groups that are on. A storage that throws is ignored, as it only loses the choice. */
export const writeSatellites = (
    storage: SavedStorage,
    groups: readonly SatelliteGroup[],
): void => {
    try {
        storage.setItem(SATELLITES_KEY, JSON.stringify(groups));
    } catch {
        // Private mode or a full quota: the switches still work for this visit.
    }
};
