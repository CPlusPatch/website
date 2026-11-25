import type { World } from "../world.ts";

/** What's focused and selected, as reactive fields that follow the world. */
export class ViewState {
    focus: string;
    selected: string | null;
    /** The clock's flags. Its time ticks every frame, so `now()` reads it instead. */
    clock: { paused: boolean; rate: number };

    #world: World;
    #off: () => void;

    constructor(world: World) {
        this.#world = world;
        this.focus = $state(world.focused);
        this.selected = $state(world.selected);
        this.clock = $state({
            paused: world.clock.paused,
            rate: world.clock.rate,
        });

        // A removal or a load can move both without a `focus` or `selection` event for each.
        this.#off = world.on((event) => {
            if (
                event.type === "focus" ||
                event.type === "selection" ||
                event.type === "scenario" ||
                event.type === "bodies"
            ) {
                this.focus = world.focused;
                this.selected = world.selected;
            }
            if (event.type === "clock" || event.type === "scenario") {
                this.clock.paused = world.clock.paused;
                this.clock.rate = world.clock.rate;
            }
        });
    }

    /** Focuses a body. The field follows once the world says so. */
    setFocus(id: string): void {
        this.#world.focus(id);
    }

    /** The clock's time in seconds since J2000. Not reactive. */
    now(): number {
        return this.#world.clock.t;
    }

    /** Sets the clock's time, rate or pause. The flags follow once the world says so. */
    setClock(change: { t?: number; rate?: number; paused?: boolean }): void {
        this.#world.setClock(change);
    }

    /** Stops following the world. */
    destroy(): void {
        this.#off();
    }
}
