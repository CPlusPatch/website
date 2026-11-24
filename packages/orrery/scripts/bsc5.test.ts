import {
    assertAlmostEquals,
    assertEquals,
    assertExists,
    assertThrows,
} from "@std/assert";
import { parseBsc5 } from "./bsc5.ts";

type Entry = { ra: number; dec: number; type: string; mag: number };

const buffer = (entries: Entry[], entryBytes = 32): Uint8Array => {
    const bytes = new Uint8Array(28 + entries.length * 32);
    const view = new DataView(bytes.buffer);
    view.setInt32(8, -entries.length, true);
    view.setInt32(24, entryBytes, true);

    entries.forEach((entry, i) => {
        const at = 28 + i * 32;
        view.setFloat32(at, i + 1, true);
        view.setFloat64(at + 4, entry.ra, true);
        view.setFloat64(at + 12, entry.dec, true);
        bytes[at + 20] = entry.type.charCodeAt(0);
        bytes[at + 21] = entry.type.charCodeAt(1);
        view.setInt16(at + 22, Math.round(entry.mag * 100), true);
    });

    return bytes;
};

Deno.test("a catalogue entry gives its position, magnitude and spectral class", () => {
    const ra = (101.287 * Math.PI) / 180;
    const dec = (-16.716 * Math.PI) / 180;

    const stars = parseBsc5(buffer([{ ra, dec, type: "A1", mag: -1.46 }]));

    assertEquals(stars.length, 1);

    const [star] = stars;

    assertExists(star);
    assertAlmostEquals(star.ra, ra, 1e-12);
    assertAlmostEquals(star.dec, dec, 1e-12);
    assertAlmostEquals(star.mag, -1.46, 1e-9);
    assertEquals(star.class, "A");
});

Deno.test("a deleted entry is skipped", () => {
    const stars = parseBsc5(
        buffer([
            { ra: 0, dec: 0, type: "  ", mag: 0 },
            { ra: 1, dec: 0.5, type: "K1", mag: 3 },
        ]),
    );

    assertEquals(
        stars.map((star) => star.class),
        ["K"],
    );
});

Deno.test("a type that isn't O to M is the other class", () => {
    const stars = parseBsc5(buffer([{ ra: 1, dec: 0.5, type: "N ", mag: 5 }]));

    assertEquals(stars[0]?.class, "other");
});

Deno.test("a file with another entry size is rejected", () => {
    assertThrows(() => parseBsc5(buffer([], 24)), Error, "32 bytes per entry");
});
