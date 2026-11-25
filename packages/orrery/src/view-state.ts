import type { Clock } from "./clock.ts";

/** What the user is looking at. Never saved with the scenario. */
export type ViewState = {
    focused: string;
    selected: string | null;
    clock: Clock;
};
