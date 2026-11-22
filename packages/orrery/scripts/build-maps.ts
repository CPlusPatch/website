/// <reference types="deno" />
/**
 * @module
 * Builds the Orrery's body maps into `src/assets/maps/`, as 2048x1024 WebP files.
 *
 * Sources:
 * - Solar System Scope 2K textures (CC BY 4.0): https://www.solarsystemscope.com/textures/
 * - Pluto: USGS, New Horizons LORRI/MVIC global mosaic, 300 m, public domain:
 *   https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m
 *
 * Credits: Solar System Scope for the maps of the Sun, planets and the Moon. NASA/JHUAPL/SwRI
 * for Pluto.
 *
 * Needs oiiotool. The directory holds the `2k_*` files and the Pluto TIFF. Run it from the
 * repository root:
 *
 *   deno run --allow-read --allow-write --allow-run=oiiotool packages/orrery/scripts/build-maps.ts <directory>
 */

import { fileURLToPath } from "node:url";
import {
    encodePnm,
    mirrorFill,
    parsePnm,
    tint,
    UNIMAGED_BELOW,
} from "./maps.ts";

const PLUTO_SOURCE = "Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif";
const PLUTO_WIDTH = 24888;
// Pluto's theme colour, #c8a593, scaled so its largest channel is 1.
const PLUTO_TINT: [number, number, number] = [200 / 200, 165 / 200, 147 / 200];

// Output name and source file. The ring keeps its alpha channel.
const MAPS: { out: string; source: string; alpha?: true }[] = [
    { out: "sun", source: "2k_sun.jpg" },
    { out: "mercury", source: "2k_mercury.jpg" },
    { out: "venus", source: "2k_venus_atmosphere.jpg" },
    { out: "earth", source: "2k_earth_daymap.jpg" },
    { out: "earth-night", source: "2k_earth_nightmap.jpg" },
    { out: "earth-clouds", source: "2k_earth_clouds.jpg" },
    { out: "moon", source: "2k_moon.jpg" },
    { out: "mars", source: "2k_mars.jpg" },
    { out: "jupiter", source: "2k_jupiter.jpg" },
    { out: "saturn", source: "2k_saturn.jpg" },
    { out: "saturn-ring", source: "2k_saturn_ring_alpha.png", alpha: true },
    { out: "uranus", source: "2k_uranus.jpg" },
    { out: "neptune", source: "2k_neptune.jpg" },
];

const [directory] = Deno.args;
if (!directory) {
    console.error("Usage: build-maps.ts <directory>");
    Deno.exit(2);
}

const maps = new URL("../src/assets/maps/", import.meta.url);
await Deno.mkdir(maps, { recursive: true });

const oiio = async (args: string[]): Promise<void> => {
    const { code, stderr } = await new Deno.Command("oiiotool", {
        args,
        stderr: "piped",
    }).output();
    // Throw rather than exit, so the `finally` still removes the temp dir.
    if (code !== 0)
        throw new Error(
            `oiiotool failed:\n${new TextDecoder().decode(stderr)}`,
        );
};

const encode = (input: string, channels: string, out: string): Promise<void> =>
    oiio([
        input,
        "--ch",
        channels,
        "-d",
        "uint8",
        "--attrib",
        "Compression",
        "webp:85",
        "-o",
        out,
    ]);

const report = async (name: string): Promise<void> => {
    const { size } = await Deno.stat(new URL(name, maps));
    console.log(`${name}, ${size} bytes`);
};

for (const { out, source, alpha } of MAPS) {
    const name = `${out}.webp`;
    await encode(
        `${directory}/${source}`,
        alpha ? "R,G,B,A" : "R,G,B",
        fileURLToPath(new URL(name, maps)),
    );
    await report(name);
}

const temp = await Deno.makeTempDir();
try {
    const grey = `${temp}/pluto.pgm`;
    const colour = `${temp}/pluto.ppm`;

    // Rolling by half the width puts longitude 0 at the centre, like the other maps.
    await oiio([
        `${directory}/${PLUTO_SOURCE}`,
        "--cshift",
        `+${PLUTO_WIDTH / 2}+0`,
        "--resize",
        "4096x2048",
        // oiiotool 3.2 writes PNM rows bottom-up, so flip to get them top-down.
        "--flip",
        "-o",
        grey,
    ]);

    const { width, height, data } = parsePnm(await Deno.readFile(grey));
    const rowMean = (y: number): number =>
        data
            .subarray(y * width, (y + 1) * width)
            .reduce((sum, v) => sum + v, 0) / width;
    if (rowMean(0) < UNIMAGED_BELOW || rowMean(height - 1) >= UNIMAGED_BELOW) {
        throw new Error(
            "Pluto's map is upside down: the unimaged black should be in the south.",
        );
    }
    const filled = mirrorFill(data, width, height);
    await Deno.writeFile(
        colour,
        encodePnm({
            width,
            height,
            channels: 3,
            data: tint(filled, PLUTO_TINT),
        }),
    );

    await oiio([
        colour,
        "--resize",
        "2048x1024",
        "-d",
        "uint8",
        "--attrib",
        "Compression",
        "webp:85",
        "-o",
        fileURLToPath(new URL("pluto.webp", maps)),
    ]);
    await report("pluto.webp");
} finally {
    await Deno.remove(temp, { recursive: true });
}
