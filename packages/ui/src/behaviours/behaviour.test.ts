/// <reference types="deno" />
import { assert, assertEquals, assertThrows } from "@std/assert";
import { behaviour } from "./behaviour.ts";

// init() only keys on the root, so any object stands in for an element.
const fakeRoot = () => ({}) as HTMLElement;

const counting = () => {
    const calls = { setup: 0, teardown: 0, signals: [] as AbortSignal[] };
    const b = behaviour(".x", (_root, signal) => {
        calls.setup++;
        calls.signals.push(signal);
        return () => calls.teardown++;
    });
    return { b, calls };
};

Deno.test("init binds a root once, however often it is called", () => {
    const { b, calls } = counting();
    const root = fakeRoot();
    const first = b.init(root);
    const second = b.init(root);
    assertEquals(calls.setup, 1);
    assert(first === second, "the same cleanup both times");
});

Deno.test("cleanup aborts the signal, tears down once, and frees the root", () => {
    const { b, calls } = counting();
    const root = fakeRoot();
    const cleanup = b.init(root);
    cleanup();
    cleanup();
    assert(calls.signals[0].aborted);
    assertEquals(calls.teardown, 1);
    b.init(root);
    assertEquals(calls.setup, 2, "bound again after cleanup");
    assert(!calls.signals[1].aborted);
});

Deno.test("init keeps each root separate", () => {
    const { b, calls } = counting();
    const one = b.init(fakeRoot());
    b.init(fakeRoot());
    one();
    assertEquals(calls.setup, 2);
    assertEquals(calls.teardown, 1);
    assert(!calls.signals[1].aborted);
});

Deno.test("a setup that throws leaves the root unbound", () => {
    let signal: AbortSignal | undefined;
    let fail = true;
    const b = behaviour(".x", (_root, s) => {
        signal = s;
        if (fail) throw new Error("no");
        return undefined;
    });
    const root = fakeRoot();
    assertThrows(() => b.init(root), Error, "no");
    assert(signal?.aborted);
    fail = false;
    b.init(root);
    assert(!signal?.aborted, "bound on the next try");
});

Deno.test("only the first binding's options count", () => {
    const seen: (string | undefined)[] = [];
    const b = behaviour<HTMLElement, string>(
        ".x",
        (_root, _signal, options) => {
            seen.push(options);
            return undefined;
        },
    );
    const root = fakeRoot();
    b.init(root, "first");
    b.init(root, "second");
    assertEquals(seen, ["first"]);
});
