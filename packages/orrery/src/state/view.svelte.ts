import type { Scene } from "./scene.ts";

/** What's focused and selected, read from the scene. The clock's flags are reactive fields. */
export class ViewState {
    /** The clock's flags, and a count of its changes. Its time ticks every frame, so `now()` reads it. */
    clock: { paused: boolean; rate: number; sets: number };

    #scene: Scene;
    #off: () => void;

    constructor(scene: Scene) {
        this.#scene = scene;
        this.clock = $state({
            paused: scene.clock.paused,
            rate: scene.clock.rate,
            sets: 0,
        });

        // The clock isn't held by the scene, so its flags are copied on the events.
        this.#off = scene.on((event) => {
            if (event.type === "clock" || event.type === "scenario") {
                this.clock.paused = scene.clock.paused;
                this.clock.rate = scene.clock.rate;
                this.clock.sets += 1;
            }
        });
    }

    get focus(): string {
        return this.#scene.focused;
    }

    get selected(): string | null {
        return this.#scene.selected;
    }

    /** Focuses a body. */
    setFocus(id: string): void {
        this.#scene.focus(id);
    }

    /** Selects a body, or clears the selection with `null`. */
    select(id: string | null): void {
        this.#scene.select(id);
    }

    /** The clock's time in seconds since J2000. Not reactive. */
    now(): number {
        return this.#scene.clock.t;
    }

    /** Sets the clock's time, rate or pause. The flags follow once the scene says so. */
    setClock(change: { t?: number; rate?: number; paused?: boolean }): void {
        this.#scene.setClock(change);
    }

    /** Stops following the scene. */
    destroy(): void {
        this.#off();
    }
}
