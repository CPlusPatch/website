/**
 * @module
 * Saving the scenario as it changes, and loading a share link from the address bar.
 */

import { cue } from "./audio/cues.ts";
import {
    decodeScenario,
    hashPayload,
    type SavedStorage,
    startTime,
    writeSaved,
} from "./persistence.ts";
import type { Notices } from "./ui/notices.ts";
import type { World } from "./world.ts";

/** How long the autosave waits for more changes, in ms. */
const SAVE_DELAY_MS = 500;

/** The parts of the browser page the session uses. */
export type Page = {
    /** The address bar's hash. */
    hash: () => string;
    /** Drops the share link from the address bar. */
    stripHash: () => void;
    /** Whether the page is hidden. */
    hidden: () => boolean;
    /** Gets `hashchange` and `pagehide`. */
    window: EventTarget;
    /** Gets `visibilitychange`. */
    document: EventTarget;
};

/** The autosave and the share link loader. */
export type Session = {
    saveSoon: () => void;
    saveNow: () => void;
    loadHash: () => Promise<void>;
    destroy: () => void;
};

/** Saves the world as it changes, and loads a share link on `hashchange`. */
export const createSession = (options: {
    world: World;
    storage: SavedStorage;
    notices: Pick<Notices, "show">;
    page: Page;
    rebuild: () => void;
}): Session => {
    const { world, storage, notices, page, rebuild } = options;

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const saveNow = () => {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        writeSaved(storage, { ...world.scenario, time: world.clock.t });
    };
    const saveSoon = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
    };

    // A running clock emits nothing, so its time is saved when the page goes.
    const onVisibility = () => {
        if (page.hidden()) saveNow();
    };

    // Each load takes an id, so a decode that finishes late can tell it's stale.
    let loadId = 0;
    let destroyed = false;

    const off = world.on((event) => {
        if (event.type === "scenario") {
            // Any new scenario, even an Import or Reset, cancels a pending link.
            loadId++;
            rebuild();
        }

        // Neither is saved, so they don't need a write.
        if (event.type !== "selection" && event.type !== "focus") saveSoon();
    });

    const loadHash = async () => {
        const payload = hashPayload(page.hash());
        if (payload === null) return;

        page.stripHash();

        const id = ++loadId;
        const result = await decodeScenario(payload);
        if (destroyed || id !== loadId) return;

        if (!result.ok) {
            notices.show(
                "destructive",
                "The shared link isn't a valid scenario, so nothing changed.",
            );
            return;
        }

        cue("load");
        world.load(result.scenario, startTime(result.scenario));
        saveNow();
    };
    const onHashChange = () => void loadHash();

    page.window.addEventListener("hashchange", onHashChange);
    page.window.addEventListener("pagehide", saveNow);
    page.document.addEventListener("visibilitychange", onVisibility);

    return {
        saveSoon,
        saveNow,
        loadHash,
        destroy: () => {
            destroyed = true;
            if (saveTimer !== undefined) saveNow();
            page.window.removeEventListener("hashchange", onHashChange);
            page.window.removeEventListener("pagehide", saveNow);
            page.document.removeEventListener("visibilitychange", onVisibility);
            off();
        },
    };
};
