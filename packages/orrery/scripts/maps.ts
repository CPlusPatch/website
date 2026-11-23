/** A decoded binary PNM image: 1 channel for P5, 3 for P6. */
export type Pnm = {
    width: number;
    height: number;
    channels: 1 | 3;
    data: Uint8Array;
};

/** Pixels with every channel below this count as unimaged. */
export const UNIMAGED_BELOW = 8;
/** Pixels the unimaged mask grows by, to cover the edge blended by the resize. */
const GROW = 2;
/** Pixels over which the filled area fades back into the image, so the patch has no hard edge. */
const FEATHER = 3;

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

/** Options for `mirrorFill`. */
export type FillOptions = {
    /** Interleaved channels per pixel. Defaults to 1. */
    channels?: 1 | 3;
    /** The hemisphere whose unimaged pixels are filled. Defaults to the south. */
    side?: "north" | "south";
};

/** Grows a mask inside rows `first` to `end` by `radius`, as a square of side 2 * radius + 1. */
const dilate = (
    mask: Uint8Array,
    width: number,
    first: number,
    end: number,
    radius: number,
): Uint8Array => {
    // Two passes of a 1-D grow make the square.
    const wide = new Uint8Array(width * (end - first));
    const out = new Uint8Array(width * (end - first));
    for (let y = 0; y < end - first; y++) {
        for (let x = 0; x < width; x++) {
            if (!mask[y * width + x]) continue;
            for (
                let dx = Math.max(0, x - radius);
                dx <= Math.min(width - 1, x + radius);
                dx++
            ) {
                wide[y * width + dx] = 1;
            }
        }
    }
    for (let y = 0; y < end - first; y++) {
        for (let x = 0; x < width; x++) {
            if (!wide[y * width + x]) continue;
            for (
                let dy = Math.max(0, y - radius);
                dy <= Math.min(end - first - 1, y + radius);
                dy++
            ) {
                out[dy * width + x] = 1;
            }
        }
    }

    return out;
};

/** Blurs a mask with a box of side 2 * radius + 1, repeating the edge rows and columns. */
const blur = (
    mask: Uint8Array,
    width: number,
    rows: number,
    radius: number,
): Float32Array => {
    const side = 2 * radius + 1;
    const across = new Float32Array(width * rows);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let d = -radius; d <= radius; d++) {
                sum +=
                    mask[y * width + Math.min(width - 1, Math.max(0, x + d))];
            }
            across[y * width + x] = sum / side;
        }
    }

    const out = new Float32Array(width * rows);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let d = -radius; d <= radius; d++) {
                sum +=
                    across[Math.min(rows - 1, Math.max(0, y + d)) * width + x];
            }
            out[y * width + x] = sum / side;
        }
    }

    return out;
};

/**
 * Fills the unimaged pixels of one hemisphere from their mirror in the other. A pixel is
 * unimaged when all its channels are below `UNIMAGED_BELOW`. The filled area fades into the
 * image over `FEATHER` pixels.
 */
export const mirrorFill = (
    pixels: Uint8Array,
    width: number,
    height: number,
    { channels = 1, side = "south" }: FillOptions = {},
): Uint8Array => {
    if (height % 2 !== 0)
        throw new Error(`Expected an even height, got ${height}.`);
    const half = height / 2;
    const first = side === "south" ? half : 0;
    const end = first + half;

    const dark = new Uint8Array(width * half);
    for (let y = 0; y < half; y++) {
        for (let x = 0; x < width; x++) {
            const at = ((first + y) * width + x) * channels;
            let unimaged = true;
            for (let c = 0; c < channels; c++) {
                if (pixels[at + c] >= UNIMAGED_BELOW) unimaged = false;
            }
            if (unimaged) dark[y * width + x] = 1;
        }
    }

    // The mask grows by FEATHER more than the blur reaches, so its core stays fully filled.
    const mask = dilate(dark, width, first, end, GROW + FEATHER);
    const alpha = blur(mask, width, half, FEATHER);

    const out = pixels.slice();
    for (let y = first; y < end; y++) {
        for (let x = 0; x < width; x++) {
            const weight = alpha[(y - first) * width + x];
            if (weight === 0) continue;
            const from = ((height - 1 - y) * width + x) * channels;
            const to = (y * width + x) * channels;
            for (let c = 0; c < channels; c++) {
                out[to + c] = Math.round(
                    pixels[to + c] * (1 - weight) + pixels[from + c] * weight,
                );
            }
        }
    }

    return out;
};

/** The RGB values of a `#rrggbb` colour. */
export const rgbFromHex = (hex: string): [number, number, number] => {
    if (!/^#[0-9a-f]{6}$/i.test(hex))
        throw new Error(`"${hex}" isn't a #rrggbb colour.`);

    return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [
        number,
        number,
        number,
    ];
};

/** The RGB multipliers of a `#rrggbb` colour, scaled so its largest channel is 1. */
export const tintFromHex = (hex: string): [number, number, number] => {
    const channels = rgbFromHex(hex);
    const max = Math.max(...channels);
    if (max === 0) throw new Error(`"${hex}" is black, so it has no tint.`);

    return [channels[0] / max, channels[1] / max, channels[2] / max];
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

/** Maps grey values to RGB, from `dark` at 0 to `light` at 255. */
export const duotone = (
    grey: Uint8Array,
    dark: [number, number, number],
    light: [number, number, number],
): Uint8Array => {
    const out = new Uint8Array(grey.length * 3);
    for (let i = 0; i < grey.length; i++) {
        const t = grey[i] / 255;
        for (let c = 0; c < 3; c++) {
            out[i * 3 + c] = Math.round(dark[c] + (light[c] - dark[c]) * t);
        }
    }

    return out;
};

/** Multiplies the saturation of interleaved RGB by `factor` (HSV), keeping hue and value. */
export const saturate = (rgb: Uint8Array, factor: number): Uint8Array => {
    const out = new Uint8Array(rgb.length);
    for (let i = 0; i < rgb.length; i += 3) {
        const max = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]);
        const min = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]);
        // Scaling each channel's distance from the max scales the saturation and keeps the hue.
        // The cap stops the smallest channel going below 0.
        const ratio = max === min ? 1 : Math.min(factor, max / (max - min));
        for (let c = 0; c < 3; c++) {
            out[i + c] = Math.round(max - (max - rgb[i + c]) * ratio);
        }
    }

    return out;
};

const LUMA = [0.299, 0.587, 0.114];

/** The mean luminance of interleaved RGB, from 0 to 1, on the encoded values. */
export const luminanceMean = (rgb: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < rgb.length; i += 3) {
        sum += LUMA[0] * rgb[i] + LUMA[1] * rgb[i + 1] + LUMA[2] * rgb[i + 2];
    }

    return sum / (rgb.length / 3) / 255;
};

/** The share of pixels above which a plain gain counts as blowing out the highlights. */
const CLIPPED = 0.01;

/**
 * Scales interleaved RGB so its mean luminance is `target`. A plain gain is used unless it would
 * push more than `CLIPPED` of the pixels to 255. Then a gamma is used, which keeps the highlights
 * below white. A `target` the image can't reach gets as close as the method allows.
 */
export const scaleToMean = (rgb: Uint8Array, target: number): Uint8Array => {
    const mean = luminanceMean(rgb);
    if (mean === 0) return rgb.slice();

    const gain = target / mean;
    const pixels = rgb.length / 3;
    let clipped = 0;
    const histograms = [0, 1, 2].map(() => new Float64Array(256));
    for (let i = 0; i < rgb.length; i += 3) {
        if (Math.max(rgb[i], rgb[i + 1], rgb[i + 2]) * gain >= 254.5) clipped++;
        for (let c = 0; c < 3; c++) histograms[c][rgb[i + c]]++;
    }

    const lut = new Uint8Array(256);
    if (clipped / pixels <= CLIPPED) {
        for (let v = 0; v < 256; v++)
            lut[v] = Math.min(255, Math.round(v * gain));
    } else {
        const meanAt = (gamma: number): number => {
            let sum = 0;
            for (let c = 0; c < 3; c++) {
                for (let v = 0; v < 256; v++) {
                    sum += LUMA[c] * histograms[c][v] * (v / 255) ** gamma;
                }
            }

            return sum / pixels;
        };
        // The mean falls as the gamma rises, so bisect.
        let low = 0.05;
        let high = 1;
        for (let step = 0; step < 40; step++) {
            const gamma = (low + high) / 2;
            if (meanAt(gamma) > target) low = gamma;
            else high = gamma;
        }
        for (let v = 0; v < 256; v++) {
            lut[v] = Math.round(255 * (v / 255) ** ((low + high) / 2));
        }
    }

    const out = new Uint8Array(rgb.length);
    for (let i = 0; i < rgb.length; i++) out[i] = lut[rgb[i]];

    return out;
};
