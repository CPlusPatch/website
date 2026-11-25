/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { createLoadingProgress } from "./loading-progress.ts";

type Report = [done: number, total: number, fill: number];

const setup = (sky: boolean) => {
    const reports: Report[] = [];
    const progress = createLoadingProgress({
        sky,
        onLoading: (done, total, fill) => reports.push([done, total, fill]),
    });
    let ready = false;
    progress.ready.then(() => {
        ready = true;
    });

    return {
        progress,
        reports,
        isReady: async () => {
            await Promise.resolve();

            return ready;
        },
    };
};

Deno.test("the files done, the total and the fill are reported", () => {
    const { progress, reports } = setup(true);

    progress.report();
    progress.sky(0.5);
    progress.maps(0, 2);
    progress.maps(1, 2);
    progress.skyDone();

    assertEquals(reports, [
        [0, 1, 0],
        [0, 1, 0.5],
        [0, 3, 0.5 / 3],
        [1, 3, 1.5 / 3],
        [2, 3, 2 / 3],
    ]);
});

Deno.test("nothing is reported while there are no files", () => {
    const { progress, reports } = setup(false);

    progress.report();
    progress.maps(0, 0);
    progress.drawn();

    assertEquals(reports, []);
});

Deno.test("a view without the sky counts only its maps", () => {
    const { progress, reports } = setup(false);

    progress.maps(1, 2);

    assertEquals(reports, [[1, 2, 0.5]]);
});

Deno.test("ready waits for the first frame, the sky and every map", async () => {
    const { progress, isReady } = setup(true);

    progress.maps(1, 1);
    progress.skyDone();
    assertEquals(await isReady(), false);

    progress.drawn();
    assertEquals(await isReady(), true);
});

Deno.test("ready doesn't resolve while a map is still loading", async () => {
    const { progress, isReady } = setup(true);

    progress.maps(0, 2);
    progress.drawn();
    progress.skyDone();
    progress.maps(1, 2);
    assertEquals(await isReady(), false);

    progress.maps(2, 2);
    assertEquals(await isReady(), true);
});

Deno.test("ready doesn't resolve while the sky is still loading", async () => {
    const { progress, isReady } = setup(true);

    progress.drawn();
    progress.sky(0.9);

    assertEquals(await isReady(), false);
});

Deno.test("nothing is reported after destroy", () => {
    const { progress, reports } = setup(true);
    progress.destroy();

    progress.sky(0.5);
    progress.maps(1, 1);
    progress.skyDone();
    progress.drawn();

    assertEquals(reports, []);
    assertEquals(progress.destroyed(), true);
});

Deno.test("destroy resolves ready before the view is ready", async () => {
    const { progress, isReady } = setup(true);

    progress.destroy();

    assertEquals(await isReady(), true);
});
