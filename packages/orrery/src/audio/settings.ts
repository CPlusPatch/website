import type { SavedStorage } from "../persistence.ts";

/** Which sounds are on. */
export type SoundSettings = { effects: boolean; music: boolean };

/** The `localStorage` key of the sound settings. */
export const SOUND_KEY = "orrery:sound:v1";

const DEFAULT: SoundSettings = { effects: true, music: true };

/** The saved sound settings, or both on if they're missing, bad or unreadable. */
export const readSound = (storage: SavedStorage): SoundSettings => {
    try {
        const raw = storage.getItem(SOUND_KEY);
        if (raw === null) return { ...DEFAULT };

        const value: unknown = JSON.parse(raw);
        if (
            typeof value === "object" &&
            value !== null &&
            "effects" in value &&
            "music" in value &&
            typeof value.effects === "boolean" &&
            typeof value.music === "boolean"
        ) {
            return { effects: value.effects, music: value.music };
        }
    } catch {
        // Falls through to the default.
    }

    return { ...DEFAULT };
};

/** Saves the sound settings. A storage that throws is ignored, as it only loses the choice. */
export const writeSound = (storage: SavedStorage, s: SoundSettings): void => {
    try {
        storage.setItem(SOUND_KEY, JSON.stringify(s));
    } catch {
        // Private mode or a full quota: the toggles still work for this visit.
    }
};
