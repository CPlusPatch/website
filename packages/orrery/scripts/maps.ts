/** A decoded binary PNM image: 1 channel for P5, 3 for P6. */
export type Pnm = {
    width: number;
    height: number;
    channels: 1 | 3;
    data: Uint8Array;
};

/** Values below this in the southern half count as unimaged. */
export const UNIMAGED_BELOW = 8;
/** Pixels the unimaged mask grows by, to cover the edge blended by the resize. */
const GROW = 2;

const isSpace = (byte: number): boolean =>
    byte === 0x20 || (byte >= 0x09 && byte <= 0x0d);

/** Parses an 8-bit binary PGM (P5) or PPM (P6). */
export const parsePnm = (bytes: Uint8Array): Pnm => {
    const magic = String.fromCharCode(bytes[0], bytes[1]);
    if (magic !== "P5" && magic !== "P6") {
        throw new Error(`Expected a P5 or P6 file, got "${magic}".`);
    }

    const numbers: number[] = [];
    let at = 2;
    while (numbers.length < 3) {
        while (at < bytes.length && isSpace(bytes[at])) at++;
        const start = at;
        while (at < bytes.length && bytes[at] >= 0x30 && bytes[at] <= 0x39)
            at++;
        if (start === at) throw new Error("The PNM header is malformed.");
        numbers.push(
            Number(new TextDecoder().decode(bytes.subarray(start, at))),
        );
    }
    // Exactly one whitespace byte separates the header from the data.
    at++;

    const [width, height, maxval] = numbers;
    if (maxval !== 255)
        throw new Error(`Expected a maxval of 255, got ${maxval}.`);

    const channels = magic === "P5" ? 1 : 3;
    const length = width * height * channels;
    if (bytes.length - at < length)
        throw new Error("The PNM file is shorter than its header says.");

    return { width, height, channels, data: bytes.slice(at, at + length) };
};

/** Encodes an image as a binary PGM (1 channel) or PPM (3 channels). */
export const encodePnm = ({
    width,
    height,
    channels,
    data,
}: Pnm): Uint8Array => {
    const header = new TextEncoder().encode(
        `${channels === 1 ? "P5" : "P6"}\n${width} ${height}\n255\n`,
    );
    const bytes = new Uint8Array(header.length + data.length);
    bytes.set(header);
    bytes.set(data, header.length);

    return bytes;
};

/** Fills the unimaged southern pixels of a grey map from their mirror in the northern half. */
export const mirrorFill = (
    pixels: Uint8Array,
    width: number,
    height: number,
): Uint8Array => {
    if (height % 2 !== 0)
        throw new Error(`Expected an even height, got ${height}.`);
    const half = height / 2;

    // Two passes of a 1-D grow make the square of side 2 * GROW + 1.
    const dark = new Uint8Array(width * height);
    for (let y = half; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (pixels[y * width + x] < UNIMAGED_BELOW) dark[y * width + x] = 1;
        }
    }

    const wide = new Uint8Array(width * height);
    for (let y = half; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!dark[y * width + x]) continue;
            for (
                let dx = Math.max(0, x - GROW);
                dx <= Math.min(width - 1, x + GROW);
                dx++
            ) {
                wide[y * width + dx] = 1;
            }
        }
    }

    const mask = new Uint8Array(width * height);
    for (let y = half; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!wide[y * width + x]) continue;
            for (
                let dy = Math.max(half, y - GROW);
                dy <= Math.min(height - 1, y + GROW);
                dy++
            ) {
                mask[dy * width + x] = 1;
            }
        }
    }

    const out = pixels.slice();
    for (let y = half; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x])
                out[y * width + x] = pixels[(height - 1 - y) * width + x];
        }
    }

    return out;
};

/** Multiplies each grey value by a colour, giving interleaved RGB. */
export const tint = (
    grey: Uint8Array,
    [r, g, b]: [number, number, number],
): Uint8Array => {
    const out = new Uint8Array(grey.length * 3);
    for (let i = 0; i < grey.length; i++) {
        out[i * 3] = Math.round(grey[i] * r);
        out[i * 3 + 1] = Math.round(grey[i] * g);
        out[i * 3 + 2] = Math.round(grey[i] * b);
    }

    return out;
};
