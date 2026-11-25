import { OBLIQUITY_J2000, rotateEquatorialToEcliptic } from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertExists,
    assertThrows,
} from "@std/assert";
import {
    decodeStars,
    encodeStars,
    type Star,
    skyUv,
    starBrightness,
    starDirections,
    starSize,
} from "./stars.ts";

const SIRIUS: Star = {
    ra: (101.287 * Math.PI) / 180,
    dec: (-16.716 * Math.PI) / 180,
    mag: -1.46,
    class: "A",
};

Deno.test("a star survives encoding within the file's resolution", () => {
    const stars: Star[] = [
        SIRIUS,
        { ra: 6.2831, dec: Math.PI / 2, mag: 6.5, class: "other" },
        { ra: 0, dec: -Math.PI / 2, mag: 0, class: "M" },
    ];

    const decoded = decodeStars(encodeStars(stars));

    assertEquals(decoded.length, stars.length);
    stars.forEach((star, i) => {
        const got = decoded[i];

        assertExists(got);
        assertAlmostEquals(got.ra, star.ra, 0.0001);
        assertAlmostEquals(got.dec, star.dec, 0.0001);
        assertAlmostEquals(got.mag, star.mag, 0.03);
        assertEquals(got.class, star.class);
    });
});

Deno.test("a right ascension that rounds up to a full turn wraps to zero", () => {
    const [star] = decodeStars(
        encodeStars([{ ...SIRIUS, ra: 2 * Math.PI - 1e-9 }]),
    );

    assertExists(star);
    assertEquals(star.ra, 0);
});

Deno.test("a star file of a length that isn't a multiple of 6 is rejected", () => {
    assertThrows(() => decodeStars(new Uint8Array(7)), Error, "multiple of 6");
});

const directionOf = (star: Star) => {
    const [x, y, z] = starDirections([star]);

    assertExists(x);
    assertExists(y);
    assertExists(z);

    return { x, y, z };
};

Deno.test("a star's direction is its equatorial vector turned into the ecliptic frame", () => {
    const cosDec = Math.cos(SIRIUS.dec);
    const expected = rotateEquatorialToEcliptic({
        x: cosDec * Math.cos(SIRIUS.ra),
        y: cosDec * Math.sin(SIRIUS.ra),
        z: Math.sin(SIRIUS.dec),
    });

    const { x, y, z } = directionOf(SIRIUS);

    assertAlmostEquals(x, expected.x, 1e-6);
    assertAlmostEquals(y, expected.y, 1e-6);
    assertAlmostEquals(z, expected.z, 1e-6);
});

Deno.test("the north celestial pole is tilted from the ecliptic pole by the obliquity", () => {
    const { x, y, z } = directionOf({
        ra: 0,
        dec: Math.PI / 2,
        mag: 2,
        class: "A",
    });

    assertAlmostEquals(x, 0, 1e-6);
    assertAlmostEquals(y, Math.sin(OBLIQUITY_J2000), 1e-6);
    assertAlmostEquals(z, Math.cos(OBLIQUITY_J2000), 1e-6);
});

Deno.test("brighter stars get bigger points, up to a limit", () => {
    assert(starSize(-1.5) > starSize(0));
    assert(starSize(0) > starSize(3));
    assert(starSize(3) > starSize(6.5));
    assertEquals(starSize(6.5), 3);
    assertEquals(starSize(-5), starSize(-1.5));
    assertAlmostEquals(starSize(-1.5), 4.8, 1e-9);
});

Deno.test("brighter stars get brighter points, between 0.06 and 0.5", () => {
    assert(starBrightness(1) > starBrightness(2));
    assert(starBrightness(2) > starBrightness(3));
    assertAlmostEquals(starBrightness(-1.46), 0.5, 1e-9);
    assertAlmostEquals(starBrightness(6.5), 0.06, 1e-9);
});

const unit = (ra: number, dec: number) =>
    directionOf({ ra, dec, mag: 2, class: "A" });

Deno.test("the sky's centre lookup is the middle of the texture", () => {
    const { u, v } = skyUv(unit(0, 0));

    assertAlmostEquals(u, 0.5, 1e-6);
    assertAlmostEquals(v, 0.5, 1e-6);
});

Deno.test("a right ascension of 90 degrees looks up a quarter of the way across", () => {
    assertAlmostEquals(skyUv(unit(Math.PI / 2, 0)).u, 0.25, 1e-6);
});

Deno.test("the north celestial pole looks up the top edge of the texture", () => {
    assertAlmostEquals(skyUv(unit(0, Math.PI / 2)).v, 1, 1e-6);
});

Deno.test("a star's direction looks up its own right ascension and declination", () => {
    for (const star of [SIRIUS, { ...SIRIUS, ra: 5.5, dec: 1.2 }]) {
        const { u, v } = skyUv(unit(star.ra, star.dec));

        assertAlmostEquals(
            u,
            0.5 - star.ra / (2 * Math.PI) + (star.ra > Math.PI ? 1 : 0),
            1e-5,
        );
        assertAlmostEquals(v, 0.5 + star.dec / Math.PI, 1e-5);
    }
});
