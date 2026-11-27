/**
 * @module
 * The animation frame loop that advances the scene's clock.
 */

import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { advanceClock } from "@cpluspatch/render";
import type { Departure, Scene } from "../state/scene.ts";

/** A running clock loop. */
export type ClockLoop = {
    /** Stops the loop. */
    stop: () => void;
    /** Whether a clock step is settling the presence of the focused and selected bodies. */
    settling: () => boolean;
};

/**
 * Advances the clock of `scene` every animation frame, and calls `onDeparture` when the new time
 * leaves the lifetime of the focused or selected body.
 * Start it before the view is built, so the clock ticks before the view's draw every frame.
 */
export const startClockLoop = (
    scene: Scene,
    onDeparture: (departure: Departure) => void,
): ClockLoop => {
    let frame = 0;
    let lastFrame = performance.now();
    let lastNowT = unixMsToJ2000s(Date.now());
    let settling = false;

    const tick = (now: number) => {
        frame = requestAnimationFrame(tick);

        const dt = Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;

        const nowT = unixMsToJ2000s(Date.now());
        advanceClock(scene.clock, dt, lastNowT, nowT);
        lastNowT = nowT;

        // The departure is one message, so the focus and selection events stay quiet.
        settling = true;
        let departure: Departure | null;
        try {
            departure = scene.settlePresence();
        } finally {
            settling = false;
        }
        if (departure !== null) onDeparture(departure);
    };
    frame = requestAnimationFrame(tick);

    return {
        stop: () => cancelAnimationFrame(frame),
        settling: () => settling,
    };
};
