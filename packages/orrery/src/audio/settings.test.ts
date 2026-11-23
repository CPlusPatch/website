/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import type { SavedStorage } from "../persistence.ts";
import { readSound, SOUND_KEY, writeSound } from "./settings.ts";

const ON = { effects: true, music: true };

const holding = (value: string | null): SavedStorage => ({
    getItem: () => value,
    setItem: () => {},
});

Deno.test("missing settings are both on", () => {
    assertEquals(readSound(holding(null)), ON);
});

Deno.test("a saved false wins over the default", () => {
    const saved = '{"effects":false,"music":true}';

    assertEquals(readSound(holding(saved)), { effects: false, music: true });
    assertEquals(readSound(holding('{"effects":false,"music":false}')), {
        effects: false,
        music: false,
    });
});

Deno.test("settings round-trip through storage", () => {
    const data = new Map<string, string>();
    const storage: SavedStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
    };

    writeSound(storage, { effects: true, music: false });

    assertEquals(data.has(SOUND_KEY), true);
    assertEquals(readSound(storage), { effects: true, music: false });
});

Deno.test("bad values are both on", () => {
    for (const raw of [
        "",
        "not json",
        "null",
        "5",
        "[]",
        "{}",
        '{"effects":true}',
        '{"effects":"yes","music":true}',
        '{"effects":1,"music":0}',
    ]) {
        assertEquals(readSound(holding(raw)), ON, raw);
    }
});

Deno.test("a storage that throws gives both on", () => {
    const storage: SavedStorage = {
        getItem: () => {
            throw new Error("denied");
        },
        setItem: () => {
            throw new Error("denied");
        },
    };

    assertEquals(readSound(storage), ON);
    writeSound(storage, { effects: true, music: true });
});
