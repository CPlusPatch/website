import { assertEquals, assertThrows } from "@std/assert";
import { encodePnm, mirrorFill, parsePnm, tint } from "./maps.ts";

/** A grey map `width` wide, with `rows` given top to bottom. */
const grid = (rows: number[][]): Uint8Array => Uint8Array.from(rows.flat());

Deno.test("an unimaged southern pixel takes the value of its mirrored row", () => {
    const width = 11;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[1 * width + 5] = 200;
    pixels[10 * width + 5] = 0;

    const out = mirrorFill(pixels, width, height);

    assertEquals(out[10 * width + 5], 200);
});

Deno.test("a dark northern pixel is left alone", () => {
    const width = 11;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[2 * width + 5] = 0;

    const out = mirrorFill(pixels, width, height);

    assertEquals(out[2 * width + 5], 0);
});

Deno.test("the unimaged mask grows by 2 px and no further", () => {
    const width = 15;
    const height = 20;
    const pixels = new Uint8Array(width * height).fill(100);
    // Mirror rows are distinct so a fill is told from an original value.
    for (let y = 0; y < height / 2; y++)
        pixels.fill(150 + y, y * width, (y + 1) * width);
    pixels[14 * width + 7] = 0;

    const out = mirrorFill(pixels, width, height);

    for (let y = 10; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const grown = Math.abs(y - 14) <= 2 && Math.abs(x - 7) <= 2;
            const expected = grown
                ? pixels[(height - 1 - y) * width + x]
                : pixels[y * width + x];
            assertEquals(out[y * width + x], expected, `pixel ${x},${y}`);
        }
    }
});

Deno.test("the mask doesn't grow into the northern half", () => {
    const width = 9;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[0 * width + 4] = 0;
    pixels[6 * width + 4] = 0;
    pixels[5 * width + 4] = 3;

    const out = mirrorFill(pixels, width, height);

    assertEquals(out[5 * width + 4], 3);
    assertEquals(out[4 * width + 4], 100);
});

Deno.test("mirrorFill returns a new array and keeps its input", () => {
    const pixels = grid([
        [9, 9],
        [0, 0],
    ]);

    const out = mirrorFill(pixels, 2, 2);

    assertEquals(Array.from(pixels), [9, 9, 0, 0]);
    assertEquals(Array.from(out), [9, 9, 9, 9]);
});

Deno.test("tint scales each channel of a grey value and rounds", () => {
    const out = tint(Uint8Array.of(0, 100, 255), [1, 165 / 200, 147 / 200]);

    assertEquals(Array.from(out), [0, 0, 0, 100, 83, 74, 255, 210, 187]);
});

Deno.test("a PPM survives an encode and parse round trip", () => {
    const image = {
        width: 2,
        height: 1,
        channels: 3 as const,
        data: Uint8Array.of(1, 2, 3, 250, 251, 252),
    };

    assertEquals(parsePnm(encodePnm(image)), image);
});

Deno.test("a PGM parses with any run of whitespace in the header", () => {
    const header = new TextEncoder().encode("P5\n 3\t2 \r\n255\n");
    const bytes = new Uint8Array([...header, 1, 2, 3, 4, 5, 6]);

    const image = parsePnm(bytes);

    assertEquals(image.width, 3);
    assertEquals(image.height, 2);
    assertEquals(image.channels, 1);
    assertEquals(Array.from(image.data), [1, 2, 3, 4, 5, 6]);
});

Deno.test("a pixel byte that looks like whitespace is kept as data", () => {
    const bytes = new Uint8Array([
        ...new TextEncoder().encode("P5\n2 1\n255\n"),
        10,
        32,
    ]);

    assertEquals(Array.from(parsePnm(bytes).data), [10, 32]);
});

Deno.test("a file that isn't P5 or P6, or is truncated, is rejected", () => {
    assertThrows(() => parsePnm(new TextEncoder().encode("P2\n1 1\n255\n0")));
    assertThrows(() => parsePnm(new TextEncoder().encode("P5\n2 2\n255\n\0")));
});

Deno.test("mirrorFill refuses an odd height, which has no clean southern half", () => {
    assertThrows(
        () => mirrorFill(new Uint8Array(3), 1, 3),
        Error,
        "even height",
    );
});

Deno.test("parsePnm refuses a maxval other than 255", () => {
    const bytes = new TextEncoder().encode("P5\n1 1\n65535\n\0\0");
    assertThrows(() => parsePnm(bytes), Error, "maxval of 255");
});
