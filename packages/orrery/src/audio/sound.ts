import type { SavedStorage } from "../persistence.ts";
import { type Cue, clearCuePlayer, setCuePlayer } from "./cues.ts";
import { createEffects } from "./effects.ts";
import { createMusic, type TrackInfo } from "./music.ts";
import { readSound, type SoundSettings, writeSound } from "./settings.ts";

/** The sound settings and the players behind them. */
export type Sound = {
    readonly settings: SoundSettings;
    setEffects: (on: boolean) => void;
    setMusic: (on: boolean) => void;
    /** The music track that's playing or about to, or `null` if there's none. */
    readonly track: TrackInfo | null;
    /** Calls back when a setting or the track changes. Returns a function that stops it. */
    onChange: (callback: () => void) => () => void;
    destroy: () => void;
};

/** Reads the saved settings and starts the sound they ask for. */
export const createSound = (storage: SavedStorage): Sound => {
    let settings = readSound(storage);
    const effects = createEffects();
    const music = createMusic();
    const listeners = new Set<() => void>();

    const notify = () => {
        for (const listener of listeners) listener();
    };
    const save = () => {
        writeSound(storage, settings);
        notify();
    };

    const play = (name: Cue) => {
        if (settings.effects) effects.play(name);
    };
    setCuePlayer(play);
    music.onTrack(notify);
    if (settings.music) music.start();

    return {
        get settings() {
            return settings;
        },
        setEffects: (on) => {
            settings = { ...settings, effects: on };
            save();
        },
        setMusic: (on) => {
            settings = { ...settings, music: on };
            if (on) music.start();
            else music.stop();
            save();
        },
        get track() {
            return music.track();
        },
        onChange: (callback) => {
            listeners.add(callback);

            return () => listeners.delete(callback);
        },
        destroy: () => {
            listeners.clear();
            music.destroy();
            effects.destroy();
            clearCuePlayer(play);
        },
    };
};
