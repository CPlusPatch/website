/// <reference types="deno" />

import type { Catalogue, Swarm } from "@cpluspatch/sim";
import {
    assert,
    assertEquals,
    assertRejects,
    assertStrictEquals,
} from "@std/assert";
import { createAssets, type Loaders } from "./assets.ts";
import type { SkyData } from "./sky.ts";

const SATELLITES = new URL("file:///satellites.bin");

const fake = <T>(): T => ({}) as T;

// Counts the calls of each loader.
const loaders = (overrides: Partial<Loaders> = {}) => {
    const calls = { sky: 0, map: 0, catalogue: 0, prepare: 0 };
    const all: Loaders = {
        sky: () => {
            calls.sky++;

            return Promise.resolve(fake<SkyData>());
        },
        map: (id) => {
            calls.map++;

            return id === "earth"
                ? Promise.resolve(fake<HTMLImageElement>())
                : null;
        },
        catalogue: () => {
            calls.catalogue++;

            return Promise.resolve(fake<Catalogue>());
        },
        prepare: () => {
            calls.prepare++;

            return fake<Swarm>();
        },
        ...overrides,
    };

    return { calls, all };
};

Deno.test("two sky calls fetch once and share the data", async () => {
    const { calls, all } = loaders();
    const assets = createAssets(SATELLITES, all);

    const first = await assets.sky();
    const second = await assets.sky();

    assertEquals(calls.sky, 1);
    assertStrictEquals(first, second);
});

Deno.test("a failed swarm load isn't cached", async () => {
    let fail = true;
    const { calls, all } = loaders({
        catalogue: () => {
            if (fail) return Promise.reject(new Error("offline"));

            return Promise.resolve(fake<Catalogue>());
        },
    });
    const assets = createAssets(SATELLITES, all);

    await assertRejects(
        () => assets.swarm({ mu: 1, radius: 1 }),
        Error,
        "offline",
    );
    fail = false;
    await assets.swarm({ mu: 1, radius: 1 });

    assertEquals(calls.prepare, 1);
});

Deno.test("the swarm decodes the catalogue once and prepares once per mu", async () => {
    const { calls, all } = loaders();
    const assets = createAssets(SATELLITES, all);

    const a = await assets.swarm({ mu: 1, radius: 1 });
    const b = await assets.swarm({ mu: 2, radius: 1 });
    const again = await assets.swarm({ mu: 1, radius: 1 });

    assertEquals(calls.catalogue, 1);
    assertEquals(calls.prepare, 2);
    assertStrictEquals(a, again);
    assert(a !== b);
});

Deno.test("an unknown map is null and isn't cached", async () => {
    const { calls, all } = loaders();
    const assets = createAssets(SATELLITES, all);

    assertEquals(assets.map("nowhere"), null);
    assertEquals(assets.map("nowhere"), null);
    const first = assets.map("earth");
    const second = assets.map("earth");

    assert(first);
    assertStrictEquals(first, second);
    assertEquals(calls.map, 3);
});
