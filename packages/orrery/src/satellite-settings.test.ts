/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import type { SavedStorage } from "./persistence.ts";
import {
    readSatellites,
    SATELLITES_KEY,
    writeSatellites,
} from "./satellite-settings.ts";

const holding = (value: string | null): SavedStorage => ({
    getItem: () => value,
    setItem: () => {},
});

Deno.test("missing settings have no group on", () => {
    assertEquals(readSatellites(holding(null)), []);
});

Deno.test("saved groups are read back", () => {
    assertEquals(readSatellites(holding('["starlink","other"]')), [
        "starlink",
        "other",
    ]);
});

Deno.test("groups round-trip through storage", () => {
    const data = new Map<string, string>();
    const storage: SavedStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
    };

    writeSatellites(storage, ["oneweb", "weather"]);

    assertEquals(data.has(SATELLITES_KEY), true);
    assertEquals(readSatellites(storage), ["oneweb", "weather"]);
});

Deno.test("unknown groups are dropped", () => {
    assertEquals(
        readSatellites(holding('["gps","constellation","oneweb",5,null]')),
        ["oneweb"],
    );
});

Deno.test("bad values have no group on", () => {
    for (const raw of ["", "not json", "null", "5", "{}", '"starlink"']) {
        assertEquals(readSatellites(holding(raw)), [], raw);
    }
});

Deno.test("a storage that throws has no group on", () => {
    const storage: SavedStorage = {
        getItem: () => {
            throw new Error("denied");
        },
        setItem: () => {
            throw new Error("denied");
        },
    };

    assertEquals(readSatellites(storage), []);
    writeSatellites(storage, ["starlink"]);
});
