/**
 * @module
 * The catalogue satellite that is selected or focused in the view.
 */

import { EARTH_RADIUS, type Vec3 } from "@cpluspatch/orbit";
import type { Body, SatelliteFacts } from "@cpluspatch/sim";
import type { PerspectiveCamera } from "three";
import type { Relative, Rig } from "./camera.ts";
import { positionOf } from "./frame.ts";
import { pointFrameDistanceKm } from "./geometry/framing.ts";
import type { SceneEvent, SceneSource } from "./source.ts";
import type { SwarmLayer } from "./swarm.ts";

/** What a listener of `View.satellite` is told about. */
export type SatelliteEvent =
    | { type: "selection"; k: number | null }
    | { type: "focus"; k: number | null };

/** The seconds either side of now that a satellite's velocity is taken over. */
const VELOCITY_HALF_SPAN = 1;

/** The pointer's id for satellite `k`, which can't clash with a body's. */
export const SATELLITE_PREFIX = "sat:";

/** The index in a pointer id from `SATELLITE_PREFIX`, or `null` for a body's id. */
export const satelliteIndex = (id: string): number | null =>
    id.startsWith(SATELLITE_PREFIX)
        ? Number(id.slice(SATELLITE_PREFIX.length))
        : null;

/**
 * The position at `t` and the velocity over `t` plus or minus `halfSpan`, from `positionAt`.
 * `null` if any of the three positions isn't placed.
 */
export const finiteVelocity = (
    positionAt: (t: number) => Vec3 | null,
    t: number,
    halfSpan: number,
): Relative | null => {
    const before = positionAt(t - halfSpan);
    const now = positionAt(t);
    const after = positionAt(t + halfSpan);
    if (!before || !now || !after) return null;

    const span = 2 * halfSpan;

    return {
        r: now,
        v: {
            x: (after.x - before.x) / span,
            y: (after.y - before.y) / span,
            z: (after.z - before.z) / span,
        },
    };
};

/** What the satellite selection and focus take from the view. */
export type SatelliteFocusDeps = {
    source: SceneSource;
    /** Clears the body selection. Must act before it returns. */
    onSelect: (id: string | null) => void;
    /** Focuses a body. Must act before it returns, as `focusing` relies on it. */
    onFocus: (id: string) => void;
    swarm: SwarmLayer;
    /** The first cloud's host, or `undefined` when the scenario has no clouds. */
    host: Body | undefined;
    rig: Rig;
    camera: PerspectiveCamera;
    /** Called after anything that can change the rig's chase. */
    notifyChase: () => void;
    /** Called after the focused satellite changes. */
    describe: () => void;
};

/** The satellite selection and focus, which sit beside the source's own. */
export type SatelliteFocus = {
    selected: () => number | null;
    focused: () => number | null;
    /** Selects satellite `k`, which clears the source's selection, or clears the satellite selection for `null`. */
    select: (k: number | null) => void;
    /** Selects satellite `k` and clears the source's selection. */
    pick: (k: number) => void;
    /** Clears the satellite selection and leaves the source's alone. */
    clear: () => void;
    /** Selects satellite `k` and follows it, framing its orbit. */
    focus: (k: number) => void;
    facts: (k: number) => SatelliteFacts | null;
    /** Calls `fn` on every change. Returns a function that stops it. */
    on: (fn: (e: SatelliteEvent) => void) => () => void;
    /** Drops a satellite that is gone, each frame. */
    check: () => void;
    /** Takes a source selection or focus change as the user's, which ends the satellite's. */
    onWorld: (event: SceneEvent) => void;
};

/** The satellite selection and focus of a view. */
export const createSatelliteFocus = ({
    source,
    onSelect,
    onFocus,
    swarm,
    host,
    rig,
    camera,
    notifyChase,
    describe,
}: SatelliteFocusDeps): SatelliteFocus => {
    let selected: number | null = null;
    let focused: number | null = null;
    // Set while the view's own `onFocus` runs, so its event isn't taken for a user's.
    let focusing = false;
    const listeners = new Set<(e: SatelliteEvent) => void>();
    // Passed as Earth's position, which gives a satellite's position relative to Earth.
    const earthCentre = { x: 0, y: 0, z: 0 };
    const emit = (event: SatelliteEvent) => {
        for (const fn of listeners) fn(event);
    };
    const selectOnly = (k: number | null) => {
        if (k === selected) return;

        selected = k;
        swarm.select(k);
        emit({ type: "selection", k });
    };
    // A satellite and a body are never selected together.
    const pick = (k: number) => {
        if (source.selected !== null) onSelect(null);
        selectOnly(k);
    };

    const focus = (k: number) => {
        pick(k);

        const facts = swarm.facts(k, source.clock.t);
        if (!facts || !host) return;

        focusing = true;
        onFocus(host.id);
        focusing = false;

        const fov = (camera.fov * Math.PI) / 180;
        const apogeeKm = facts.apogeeKm + EARTH_RADIUS / 1000;
        rig.focusPoint(
            () => {
                const frame = {
                    system: source.system,
                    snapshot: source.snapshot(),
                };
                const earth = positionOf(frame, host.id) ?? rig.origin();

                return swarm.positionOf(k, source.clock.t, earth) ?? earth;
            },
            pointFrameDistanceKm(apogeeKm, fov, camera.aspect),
            () =>
                finiteVelocity(
                    (t) => swarm.positionOf(k, t, earthCentre),
                    source.clock.t,
                    VELOCITY_HALF_SPAN,
                ),
        );
        notifyChase();

        // Emitted even on a refocus, so its announcement follows Earth's.
        focused = k;
        emit({ type: "focus", k });
        describe();
    };

    return {
        selected: () => selected,
        focused: () => focused,
        select: (k) => (k === null ? selectOnly(null) : pick(k)),
        pick,
        clear: () => selectOnly(null),
        focus,
        facts: (k) => swarm.facts(k, source.clock.t),
        on: (fn) => {
            listeners.add(fn);

            return () => {
                listeners.delete(fn);
            };
        },
        check: () => {
            // A satellite leaves when its group is turned off or the clock leaves the snapshot.
            if (host && focused !== null && !swarm.available(focused)) {
                onFocus(host.id);
            }
            if (selected !== null && !swarm.available(selected)) {
                selectOnly(null);
            }
        },
        onWorld: (event) => {
            if (event.type === "selection") {
                if (event.id !== null) selectOnly(null);
            } else if (event.type === "focus") {
                if (!focusing && focused !== null) {
                    focused = null;
                    emit({ type: "focus", k: null });
                }
            }
        },
    };
};
