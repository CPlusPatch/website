import type { Clock } from "@cpluspatch/render";
import type { Scenario } from "@cpluspatch/sim";
import { DocumentStore } from "./document.svelte.ts";
import { ReactiveHeld } from "./held.svelte.ts";
import { Scene } from "./scene.ts";
import { ViewState } from "./view.svelte.ts";

/** A `Scene` whose state lives in `$state` fields, and the stores that read it. */
export const createStores = (
    scenario: Scenario,
    clock: Clock,
): { scene: Scene; documentStore: DocumentStore; viewState: ViewState } => {
    const scene = new Scene(
        scenario,
        clock,
        (initial) => new ReactiveHeld(initial),
    );

    return {
        scene,
        documentStore: new DocumentStore(scene),
        viewState: new ViewState(scene),
    };
};
