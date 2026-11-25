/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import type { Texture } from "three";
import { createMaps } from "./maps.ts";

const image = {} as HTMLImageElement;

/** A map source whose requests settle when the test says so. */
const source = () => {
    const resolvers: (() => void)[] = [];

    return {
        images: () =>
            new Promise<HTMLImageElement>((resolve) => {
                resolvers.push(() => resolve(image));
            }),
        settle: async (k: number) => {
            resolvers[k]?.();
            await Promise.resolve();
            await Promise.resolve();
        },
    };
};

Deno.test("a map is loaded once, and counted as done when it settles", async () => {
    const { images, settle } = source();
    const calls: [number, number][] = [];
    const maps = createMaps(images, 1, (done, total) =>
        calls.push([done, total]),
    );
    let loaded = 0;

    maps.load("earth", () => loaded++);
    maps.load("earth", () => loaded++);
    await settle(0);

    assertEquals(loaded, 1);
    assertEquals(calls, [
        [0, 1],
        [1, 1],
    ]);

    maps.dispose();
});

Deno.test("a released map loads again, and the total counts both requests", async () => {
    const { images, settle } = source();
    const calls: [number, number][] = [];
    const maps = createMaps(images, 1, (done, total) =>
        calls.push([done, total]),
    );
    const textures: Texture[] = [];

    maps.load("earth", (texture) => textures.push(texture));
    await settle(0);
    maps.release("earth");
    maps.load("earth", (texture) => textures.push(texture));
    await settle(1);

    assertEquals(textures.length, 2);
    assertEquals(calls.at(-1), [2, 2]);

    maps.dispose();
});

Deno.test("a request that settles after its release isn't handed over but still counts", async () => {
    const { images, settle } = source();
    const calls: [number, number][] = [];
    const maps = createMaps(images, 1, (done, total) =>
        calls.push([done, total]),
    );
    const textures: Texture[] = [];

    maps.load("earth", (texture) => textures.push(texture));
    maps.release("earth");
    maps.load("earth", (texture) => textures.push(texture));
    await settle(0);
    assertEquals(textures.length, 0);

    await settle(1);

    assertEquals(textures.length, 1);
    assertEquals(calls.at(-1), [2, 2]);

    maps.dispose();
});

Deno.test("releasing a map disposes its texture", async () => {
    const { images, settle } = source();
    const maps = createMaps(images, 1);
    let texture: Texture | null = null;
    let disposed = 0;

    maps.load("earth", (loaded) => {
        texture = loaded;
        loaded.addEventListener("dispose", () => disposed++);
    });
    await settle(0);
    maps.release("earth");

    assertEquals(texture === null, false);
    assertEquals(disposed, 1);

    maps.dispose();
});
