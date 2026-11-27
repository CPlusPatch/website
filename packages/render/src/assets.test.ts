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

const fake = <T>(): T => ({}) as T;

// Counts the calls of each loader.
const loaders = (overrides: Partial<Loaders> = {}) => {
    const calls = { sky: 0, map: 0, prepare: 0 };
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
        prepare: () => {
            calls.prepare++;

            return fake<Swarm>();
        },
        ...overrides,
    };

    return { calls, all };
};

// Counts the calls of the satellite loader.
const satellites = (fail = () => false) => {
    const calls = { count: 0 };
    const load = () => {
        calls.count++;
        if (fail()) return Promise.reject(new Error("offline"));

        return Promise.resolve(fake<Catalogue>());
    };

    return { calls, load };
};

Deno.test("two sky calls fetch once and share the data", async () => {
    const { calls, all } = loaders();
    const assets = createAssets(satellites().load, all);

    const first = await assets.sky();
    const second = await assets.sky();

    assertEquals(calls.sky, 1);
    assertStrictEquals(first, second);
});

Deno.test("a failed swarm load isn't cached", async () => {
    let fail = true;
    const { calls, all } = loaders();
    const { load } = satellites(() => fail);
    const assets = createAssets(load, all);

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
    const satellite = satellites();
    const assets = createAssets(satellite.load, all);

    const a = await assets.swarm({ mu: 1, radius: 1 });
    const b = await assets.swarm({ mu: 2, radius: 1 });
    const again = await assets.swarm({ mu: 1, radius: 1 });

    assertEquals(satellite.calls.count, 1);
    assertEquals(calls.prepare, 2);
    assertStrictEquals(a, again);
    assert(a !== b);
});

Deno.test("an unknown map is null and isn't cached", async () => {
    const { calls, all } = loaders();
    const assets = createAssets(satellites().load, all);

    assertEquals(assets.map("nowhere"), null);
    assertEquals(assets.map("nowhere"), null);
    const first = assets.map("earth");
    const second = assets.map("earth");

    assert(first);
    assertStrictEquals(first, second);
    assertEquals(calls.map, 3);
});
