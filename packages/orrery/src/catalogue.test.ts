import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import {
    type CatalogueEntry,
    decodeCatalogue,
    encodeCatalogue,
} from "./catalogue.ts";

const entry = (overrides: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
    name: "ISS (ZARYA)",
    group: "other",
    epoch: Date.UTC(2026, 10, 23, 12),
    meanMotion: 0.0011,
    eccentricity: 0.0005,
    inclination: 0.9,
    raan: 3.1,
    argp: 1.2,
    m0: 5.5,
    ...overrides,
});

const ENTRIES: CatalogueEntry[] = [
    entry(),
    entry({
        name: "STARLINK-1007",
        group: "starlink",
        epoch: Date.UTC(2026, 10, 23, 6),
    }),
    entry({ name: "天链 ☆ 1", group: "phone-iot", m0: 0.25 }),
];

Deno.test("a catalogue survives encoding within float32 precision", () => {
    const decoded = decodeCatalogue(encodeCatalogue(ENTRIES));

    assertEquals(decoded.epoch, Date.UTC(2026, 10, 23, 12));
    assertEquals(decoded.names, ["ISS (ZARYA)", "STARLINK-1007", "天链 ☆ 1"]);
    assertEquals(Array.from(decoded.groups), [8, 0, 4]);
    assertEquals(decoded.elements.length, 21);
    ENTRIES.forEach((e, i) => {
        const at = i * 7;
        assertEquals(decoded.elements[at], (e.epoch - decoded.epoch) / 1000);
        assertAlmostEquals(decoded.elements[at + 1], e.meanMotion, 1e-9);
        assertAlmostEquals(decoded.elements[at + 2], e.eccentricity, 1e-9);
        assertAlmostEquals(decoded.elements[at + 3], e.inclination, 1e-6);
        assertAlmostEquals(decoded.elements[at + 4], e.raan, 1e-6);
        assertAlmostEquals(decoded.elements[at + 5], e.argp, 1e-6);
        assertAlmostEquals(decoded.elements[at + 6], e.m0, 1e-6);
    });
});

Deno.test("the epoch is the latest, so every offset is zero or less", () => {
    const decoded = decodeCatalogue(encodeCatalogue(ENTRIES));

    assertEquals(decoded.elements[0], 0);
    assertEquals(decoded.elements[7], -6 * 3600);
});

Deno.test("encoding the same entries twice gives the same bytes", () => {
    assertEquals(encodeCatalogue(ENTRIES), encodeCatalogue([...ENTRIES]));
});

Deno.test("an empty catalogue round-trips", () => {
    const decoded = decodeCatalogue(encodeCatalogue([]));

    assertEquals(decoded.names, []);
    assertEquals(decoded.groups.length, 0);
    assertEquals(decoded.elements.length, 0);
});

Deno.test("a name with a newline can't be encoded", () => {
    assertThrows(
        () => encodeCatalogue([entry({ name: "A\nB" })]),
        Error,
        "newline",
    );
});

Deno.test("a bad magic number throws", () => {
    const bytes = encodeCatalogue(ENTRIES);
    bytes[0] = 0x58;

    assertThrows(() => decodeCatalogue(bytes), Error, "Not a satellite file");
});

Deno.test("an unknown version throws", () => {
    const bytes = encodeCatalogue(ENTRIES);
    bytes[4] = 2;

    assertThrows(() => decodeCatalogue(bytes), Error, "version 2");
});

Deno.test("truncated input throws", () => {
    const bytes = encodeCatalogue(ENTRIES);

    assertThrows(() => decodeCatalogue(bytes.slice(0, 10)), Error, "header");
    assertThrows(() => decodeCatalogue(bytes.slice(0, 60)), Error, "count");
});

Deno.test("a name list that doesn't match the count throws", () => {
    const bytes = encodeCatalogue(ENTRIES);

    assertThrows(
        () => decodeCatalogue(bytes.slice(0, bytes.length - 20)),
        Error,
        "names",
    );
});

Deno.test("an unknown group byte throws", () => {
    const bytes = encodeCatalogue(ENTRIES);
    bytes[20 + ENTRIES.length * 7 * 4] = 9;

    assertThrows(() => decodeCatalogue(bytes), Error, "group");
});
