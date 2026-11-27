/**
 * @module
 * The first build of the view, which falls back to the solar system when the scenario can't be drawn.
 */

import { solarSystem } from "@cpluspatch/catalog";
import type { View } from "@cpluspatch/render";
import { documentOf } from "@cpluspatch/sim";
import { type Source, startTime } from "../persistence.ts";
import type { Scene } from "../state/scene.ts";

/** The view, or `null` if WebGL isn't available, and whether the solar system replaced the scenario. */
export type FirstBuild = { view: View | null; fellBack: boolean };

/**
 * Calls `build`. If it throws on a scenario other than the solar system, loads the solar system
 * and builds again, and `onFallback` gets the notice to show once that draws.
 * A throw from the second build, or from the solar system's, goes to the caller.
 */
export const buildFirst = (
    scene: Pick<Scene, "scenario" | "load">,
    source: Source,
    build: () => View | null,
    onFallback: (text: string) => void,
): FirstBuild => {
    try {
        return { view: build(), fellBack: false };
    } catch (error) {
        // A saved copy or link that can't be drawn mustn't lock the page out.
        if (scene.scenario === solarSystem) throw error;

        scene.load(documentOf(solarSystem), startTime(solarSystem));
        const view = build();
        if (view) {
            const subject =
                source === "saved" ? "Your saved copy" : "The shared link";
            onFallback(
                `${subject} can't be drawn, so the solar system opened.`,
            );
        }

        return { view, fellBack: true };
    }
};
