/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { Clock } from "@cpluspatch/render";
import { documentOf } from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { Scene } from "../state/scene.ts";
import { startClockLoop } from "./clock-loop.ts";

/** Runs `body` with a manual `requestAnimationFrame`. `step` runs the queued frame. */
const withFrames = (
    body: (step: (now: number) => void, cancelled: number[]) => void,
) => {
    const original = {
        request: globalThis.requestAnimationFrame,
        cancel: globalThis.cancelAnimationFrame,
    };
    let queued: ((now: number) => void) | null = null;
    const cancelled: number[] = [];
    globalThis.requestAnimationFrame = (fn) => {
        queued = fn;

        return 7;
    };
    globalThis.cancelAnimationFrame = (id) => {
        cancelled.push(id);
    };

    try {
        body((now) => queued?.(now), cancelled);
    } finally {
        globalThis.requestAnimationFrame = original.request;
        globalThis.cancelAnimationFrame = original.cancel;
    }
};

Deno.test("a frame advances the clock, and stop cancels the next one", () => {
    withFrames((step, cancelled) => {
        const scene = new Scene(
            documentOf(solarSystem),
            new Clock(0, 100, false),
        );
        const loop = startClockLoop(scene, () => {});

        step(performance.now() + 50);

        assertEquals(scene.clock.t > 0, true);

        loop.stop();

        assertEquals(cancelled, [7]);
    });
});

Deno.test("settling is true only while the presence settles", () => {
    withFrames((step) => {
        const scene = new Scene(
            documentOf(solarSystem),
            new Clock(0, 1, false),
        );
        const seen: boolean[] = [];
        const loop = startClockLoop(scene, () => {});
        const settle = scene.settlePresence.bind(scene);
        scene.settlePresence = () => {
            seen.push(loop.settling());

            return settle();
        };

        step(performance.now() + 16);

        assertEquals(seen, [true]);
        assertEquals(loop.settling(), false);
    });
});
