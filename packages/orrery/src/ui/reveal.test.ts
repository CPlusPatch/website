/// <reference types="deno" />
import type { View } from "@cpluspatch/render";
import { assertEquals } from "@std/assert";
import { createReveal } from "./reveal.ts";

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const fakeView = (ready: Promise<void> = Promise.resolve()) => {
    const state = { revealed: 0 };
    const view = {
        ready,
        reveal: () => state.revealed++,
    } as unknown as View;

    return { view, state };
};

const setup = (current: () => View | null) => {
    const log: string[] = [];
    const reveal = createReveal(
        { reveal: () => log.push("loading") },
        current,
        () => log.push("inert"),
    );

    return { reveal, log };
};

Deno.test("the reveal runs once, and shows the view", () => {
    const { view, state } = fakeView();
    const { reveal, log } = setup(() => view);

    reveal.reveal();
    reveal.reveal();

    assertEquals(log, ["inert", "loading"]);
    assertEquals(state.revealed, 1);
    assertEquals(reveal.revealed(), true);
});

Deno.test("a view that is ready reveals", async () => {
    const { view } = fakeView();
    const { reveal, log } = setup(() => view);

    reveal.start(view, 1000);
    await wait(0);

    assertEquals(log, ["inert", "loading"]);
    reveal.destroy();
});

Deno.test("a view that was replaced before it was ready doesn't reveal", async () => {
    const old = fakeView();
    const next = fakeView(new Promise(() => {}));
    let current = old.view;
    const { reveal, log } = setup(() => current);

    reveal.whenReady(old.view);
    current = next.view;
    await wait(0);

    assertEquals(log, []);
    assertEquals(reveal.revealed(), false);
});

Deno.test("the wait ends the loading state when the view never is ready", async () => {
    const { view } = fakeView(new Promise(() => {}));
    const { reveal, log } = setup(() => view);

    reveal.start(view, 5);
    await wait(30);

    assertEquals(log, ["inert", "loading"]);
});

Deno.test("a destroyed reveal does nothing", async () => {
    const { view } = fakeView(new Promise(() => {}));
    const { reveal, log } = setup(() => view);

    reveal.start(view, 5);
    reveal.destroy();
    reveal.reveal();
    await wait(30);

    assertEquals(log, []);
    assertEquals(reveal.revealed(), false);
});
