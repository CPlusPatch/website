import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import {
    duotone,
    encodePnm,
    luminanceMean,
    mirrorFill,
    parsePnm,
    rgbFromHex,
    saturate,
    scaleToMean,
    tint,
    tintFromHex,
} from "./maps.ts";

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

Deno.test("the fill covers 2 px around an unimaged pixel, then fades out by 8 px", () => {
    const width = 31;
    const height = 40;
    const pixels = new Uint8Array(width * height).fill(100);
    // Mirror rows are distinct so a fill is told from an original value.
    for (let y = 0; y < height / 2; y++)
        pixels.fill(150 + y, y * width, (y + 1) * width);
    pixels[30 * width + 15] = 0;

    const out = mirrorFill(pixels, width, height);

    for (let y = 20; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const distance = Math.max(Math.abs(y - 30), Math.abs(x - 15));
            const mirror = pixels[(height - 1 - y) * width + x];
            const got = out[y * width + x];
            const label = `pixel ${x},${y}`;

            assertExists(mirror, label);
            assertExists(got, label);

            if (distance <= 2) assertEquals(got, mirror, label);
            else if (distance >= 9) assertEquals(got, 100, label);
            else if (distance <= 7) assert(got > 100 && got < mirror, label);
        }
    }
});

Deno.test("the fade is the same on every side of the unimaged area", () => {
    const width = 31;
    const height = 40;
    const pixels = new Uint8Array(width * height).fill(100);
    for (let y = 0; y < height / 2; y++)
        pixels.fill(150 + y, y * width, (y + 1) * width);
    pixels[30 * width + 15] = 0;

    const out = mirrorFill(pixels, width, height);
    const blend = (x: number, y: number): number => {
        const got = out[y * width + x];
        const mirror = pixels[(height - 1 - y) * width + x];

        assertExists(got);
        assertExists(mirror);

        return (got - 100) / (mirror - 100);
    };

    assertEquals(blend(15 + 5, 30) > 0 && blend(15 + 5, 30) < 1, true);
    assertEquals(blend(15 - 5, 30), blend(15 + 5, 30));
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

Deno.test("an unimaged northern pixel takes the value of its mirrored row", () => {
    const width = 11;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[10 * width + 5] = 200;
    pixels[1 * width + 5] = 0;

    const out = mirrorFill(pixels, width, height, { side: "north" });

    assertEquals(out[1 * width + 5], 200);
});

Deno.test("a dark southern pixel is left alone when filling the north", () => {
    const width = 11;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[9 * width + 5] = 0;

    const out = mirrorFill(pixels, width, height, { side: "north" });

    assertEquals(out[9 * width + 5], 0);
});

Deno.test("the northern mask doesn't grow into the southern half", () => {
    const width = 9;
    const height = 12;
    const pixels = new Uint8Array(width * height).fill(100);
    pixels[5 * width + 4] = 0;
    pixels[6 * width + 4] = 3;

    const out = mirrorFill(pixels, width, height, { side: "north" });

    assertEquals(out[6 * width + 4], 3);
    assertEquals(out[7 * width + 4], 100);
});

Deno.test("an RGB pixel is unimaged only when all its channels are dark", () => {
    const width = 40;
    const height = 4;
    const pixels = new Uint8Array(width * height * 3).fill(100);
    // Row 0 is the mirror of row 3.
    pixels.set([10, 20, 30], (0 * width + 2) * 3);
    // Dark in every channel: filled.
    pixels.set([0, 0, 0], (3 * width + 2) * 3);
    // Dark in two channels only: kept.
    pixels.set([0, 5, 200], (3 * width + 39) * 3);

    const out = mirrorFill(pixels, width, height, { channels: 3 });

    assertEquals(
        Array.from(out.subarray((3 * width + 2) * 3, (3 * width + 3) * 3)),
        [10, 20, 30],
    );
    assertEquals(
        Array.from(out.subarray((3 * width + 39) * 3, (3 * width + 40) * 3)),
        [0, 5, 200],
    );
});

Deno.test("an RGB pixel is filled from the north when the south is imaged", () => {
    const width = 40;
    const height = 4;
    const pixels = new Uint8Array(width * height * 3).fill(100);
    const at = (x: number, y: number): number => (y * width + x) * 3;
    // A dark pixel with a different value in each channel is kept, whichever channel is lit.
    pixels.set([0, 0, 200], at(39, 0));
    pixels.set([0, 8, 0], at(39, 1));
    pixels.set([9, 0, 0], at(0, 1));
    // Every channel is dark here: filled from its mirror.
    pixels.set([0, 0, 0], at(20, 1));
    pixels.set([1, 2, 3], at(20, 2));

    const out = mirrorFill(pixels, width, height, {
        channels: 3,
        side: "north",
    });

    assertEquals(Array.from(out.subarray(at(20, 1), at(20, 1) + 3)), [1, 2, 3]);
    assertEquals(
        Array.from(out.subarray(at(39, 0), at(39, 0) + 3)),
        [0, 0, 200],
    );
    assertEquals(Array.from(out.subarray(at(39, 1), at(39, 1) + 3)), [0, 8, 0]);
    assertEquals(Array.from(out.subarray(at(0, 1), at(0, 1) + 3)), [9, 0, 0]);
});

Deno.test("filling the north and then the south works on the same buffer", () => {
    const width = 40;
    const height = 12;
    const pixels = new Uint8Array(width * height * 3).fill(100);
    const at = (x: number, y: number): number => (y * width + x) * 3;
    pixels.set([0, 0, 0], at(1, 0));
    pixels.set([40, 50, 60], at(1, 11));
    pixels.set([0, 0, 0], at(35, 11));
    pixels.set([70, 80, 90], at(35, 0));

    let out = mirrorFill(pixels, width, height, { channels: 3, side: "north" });
    out = mirrorFill(out, width, height, { channels: 3, side: "south" });

    assertEquals(
        Array.from(out.subarray(at(1, 0), at(1, 0) + 3)),
        [40, 50, 60],
    );
    assertEquals(
        Array.from(out.subarray(at(35, 11), at(35, 11) + 3)),
        [70, 80, 90],
    );
});

Deno.test("tintFromHex rejects black, which has no largest channel to scale", () => {
    assertThrows(() => tintFromHex("#000000"), Error, "black");
});

Deno.test("tintFromHex scales a colour so its largest channel is 1", () => {
    assertEquals(tintFromHex("#c8a593"), [1, 165 / 200, 147 / 200]);
    assertEquals(tintFromHex("#EEF4F7")[2], 1);
});

Deno.test("tintFromHex rejects anything but #rrggbb", () => {
    assertThrows(() => tintFromHex("c8a593"), Error, "#rrggbb");
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

const rgb = (...values: number[]): Uint8Array => Uint8Array.from(values);

Deno.test("duotone maps black to the dark colour and white to the light one", () => {
    const out = duotone(
        Uint8Array.of(0, 255, 100),
        [90, 58, 46],
        [214, 210, 204],
    );

    assertEquals(Array.from(out), [90, 58, 46, 214, 210, 204, 139, 118, 108]);
});

Deno.test("rgbFromHex reads a colour and rejects anything but #rrggbb", () => {
    assertEquals(rgbFromHex("#5a3a2E"), [90, 58, 46]);
    assertThrows(() => rgbFromHex("5a3a2e"), Error, "#rrggbb");
});

Deno.test("saturate keeps the hue and the value, and scales the saturation", () => {
    // Saturation 0.5 and value 200 become 0.65 and 200. Hue is unchanged.
    const out = saturate(rgb(200, 150, 100), 1.3);

    assertEquals(Array.from(out), [200, 135, 70]);
});

Deno.test("saturate stops at full saturation and leaves greys alone", () => {
    assertEquals(Array.from(saturate(rgb(200, 30, 20), 2)), [200, 11, 0]);
    assertEquals(Array.from(saturate(rgb(90, 90, 90), 2)), [90, 90, 90]);
});

Deno.test("luminanceMean weights the channels and divides by 255", () => {
    assertEquals(luminanceMean(rgb(255, 255, 255, 0, 0, 0)), 0.5);
    assertEquals(Math.round(luminanceMean(rgb(0, 255, 0)) * 1000), 587);
});

Deno.test("scaleToMean uses a plain gain when little would clip", () => {
    // 100 pixels, none near white: the gain is exactly 2.
    const grey = new Uint8Array(300).fill(50);

    const out = scaleToMean(grey, 100 / 255);

    assertEquals(new Set(out), new Set([100]));
});

Deno.test("scaleToMean darkens by a gain", () => {
    const out = scaleToMean(new Uint8Array(30).fill(200), 50 / 255);

    assertEquals(new Set(out), new Set([50]));
});

Deno.test("scaleToMean uses a gamma, not a gain, when more than 1% would hit 255", () => {
    // Half the pixels are 200, so a gain of 1.5 would clip them.
    const grey = new Uint8Array(300);
    grey.fill(200, 0, 150);
    grey.fill(40, 150);
    const before = luminanceMean(grey);

    const out = scaleToMean(grey, before * 1.5);

    assertEquals(Math.abs(luminanceMean(out) - before * 1.5) < 0.005, true);
    assertEquals(Math.max(...out) < 255, true);
});

Deno.test("scaleToMean leaves a black image black", () => {
    assertEquals(
        Array.from(scaleToMean(new Uint8Array(6), 0.5)),
        [0, 0, 0, 0, 0, 0],
    );
});
