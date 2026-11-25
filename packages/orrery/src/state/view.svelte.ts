import type { World } from "../world.ts";

/** What's focused and selected, as reactive fields that follow the world. */
export class ViewState {
    focus: string;
    selected: string | null;

    #world: World;
    #off: () => void;

    constructor(world: World) {
        this.#world = world;
        this.focus = $state(world.focused);
        this.selected = $state(world.selected);

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
        });
    }

    /** Focuses a body. The field follows once the world says so. */
    setFocus(id: string): void {
        this.#world.focus(id);
    }

    /** Stops following the world. */
    destroy(): void {
        this.#off();
    }
}
