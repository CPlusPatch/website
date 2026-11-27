/**
 * @module
 * What the Orrery does when its view reports a satellite pick or a chase change, and the
 * shortcuts that act on the view.
 */

import type { View } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import {
    announcement,
    chaseAnnouncement,
    noChaseAnnouncement,
    satelliteAnnouncement,
} from "../announce.ts";
import { cue } from "../audio/cues.ts";
import type { Scene } from "../state/scene.ts";
import type { ShortcutActions } from "./shortcuts.ts";

/** The name of the body `id`, or `id` itself if the scenario has none by it. */
export const bodyName = (
    bodies: readonly Pick<Body, "id" | "name">[],
    id: string,
): string => bodies.find((body) => body.id === id)?.name ?? id;

/** What `bindViewEvents` calls that isn't the view's or the scene's. */
export type ViewEventActions = {
    /** Shows the followed satellite in the crumbs, or drops it with `null`. */
    setSatellite: (crumb: { name: string; onClick: () => void } | null) => void;
    closeKeys: () => void;
    announce: (text: string) => void;
};

/**
 * Follows the satellite and chase events of `view`.
 * Returns a function that stops it and clears the crumbs' satellite.
 */
export const bindViewEvents = (
    view: View,
    scene: Scene,
    { setSatellite, closeKeys, announce }: ViewEventActions,
): (() => void) => {
    const offSatellite = view.satellite.on((event) => {
        const k = event.k;
        const name =
            k === null ? null : (view.satellite.facts(k)?.name ?? null);

        if (event.type === "focus") {
            setSatellite(
                k === null || name === null
                    ? null
                    : { name, onClick: () => view.satellite.focus(k) },
            );
        }
        if (event.type === "selection" && k !== null) {
            cue("select");
            // The keys card hides the orbit card, so a new pick would show nothing.
            closeKeys();
        }

        // A body pick clears the satellite, and the scene's "Selected ..." follows or comes first.
        if (
            event.type === "selection" &&
            k === null &&
            scene.selected !== null
        ) {
            return;
        }

        const message = satelliteAnnouncement(event, name);
        if (message !== null) announce(message);
    });

    let wasChasing = view.chasing();
    const offChase = view.onChase(({ chasing }) => {
        if (chasing === wasChasing) return;

        wasChasing = chasing;

        const k = view.satellite.focused();
        const name =
            (k === null ? null : view.satellite.facts(k)?.name) ??
            bodyName(scene.scenario.bodies, scene.focused);
        announce(chaseAnnouncement(chasing, name));
    });

    return () => {
        offSatellite();
        offChase();
        setSatellite(null);
    };
};

/**
 * Announces the selection and focus events of `scene`, except while `settling`, and plays the
 * select cue.
 * Returns a function that stops it.
 */
export const bindSceneEvents = (
    scene: Scene,
    settling: () => boolean,
    { closeKeys, announce }: Omit<ViewEventActions, "setSatellite">,
): (() => void) =>
    scene.on((event) => {
        if (event.type === "selection" && event.id !== null) cue("select");
        // The keys card hides the orbit card, so a new pick would show nothing.
        if (event.type === "selection" && event.id !== null) closeKeys();

        // A rebuilt scenario isn't announced, as its view is new.
        const message = settling()
            ? null
            : announcement(event, scene.scenario.bodies);
        if (message !== null) announce(message);
    });

/** The shortcuts that act on the current view, which is `null` while there is none. */
export const viewShortcuts = (
    scene: Scene,
    view: () => View | null,
    announce: (text: string) => void,
): Pick<
    ShortcutActions,
    "clearSatellite" | "focusSatellite" | "toggleChase"
> => ({
    clearSatellite: () => {
        const satellite = view()?.satellite;
        if (!satellite || satellite.selected() === null) return false;

        satellite.select(null);

        return true;
    },
    focusSatellite: () => {
        const satellite = view()?.satellite;
        const k = satellite?.selected() ?? null;
        if (!satellite || k === null) return false;

        satellite.focus(k);

        return true;
    },
    toggleChase: () => {
        const current = view();
        if (!current) return;

        if (current.canChase()) {
            current.chase(!current.chasing());
        } else {
            announce(
                noChaseAnnouncement(
                    bodyName(scene.scenario.bodies, scene.focused),
                ),
            );
        }
    },
});
