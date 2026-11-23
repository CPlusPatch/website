/// <reference types="deno" />
/**
 * @module
 * Builds the Orrery's body maps into `src/assets/maps/` as WebP files: 2048x1024 for the planets
 * and Pluto, 1024x512 for the moons, Ceres and Vesta.
 *
 * Sources:
 * - Solar System Scope 2K textures (CC BY 4.0): https://www.solarsystemscope.com/textures/
 * - Pluto: USGS, New Horizons LORRI/MVIC global mosaic, 300 m, public domain:
 *   https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m
 * - The moons, Ceres and Vesta: global mosaics from USGS Astrogeology and DLR, named in `MOONS`
 *   below. Search by file name at https://astrogeology.usgs.gov/search
 *
 * Credits: Solar System Scope for the maps of the Sun, planets and the Moon. NASA/JHUAPL/SwRI
 * for Pluto and Charon. USGS Astrogeology and DLR, from NASA (Voyager, Galileo, Cassini, Dawn)
 * and ESA (Mars Express) data, for Jupiter's and Saturn's major moons (not Titan), Triton,
 * Phobos, Ceres and Vesta.
 *
 * Needs oiiotool. The directory holds the `2k_*` files, the Pluto TIFF and the moon TIFFs. With
 * `--moons`, only the moon, Ceres and Vesta maps are built, so the directory needs just their
 * TIFFs. Run it from the repository root:
 *
 *   deno run --allow-read --allow-write --allow-run=oiiotool packages/orrery/scripts/build-maps.ts <directory> [--moons]
 */

import { fileURLToPath } from "node:url";
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
    UNIMAGED_BELOW,
} from "./maps.ts";

type Side = "north" | "south";

type Filled = {
    out: string;
    source: string;
    // Rolls half the width, for a source whose longitude 0 is at the left edge.
    roll?: true;
    // Unimaged bands to fill from the opposite hemisphere.
    fill?: Side[];
    // A `#rrggbb` colour, for a grey source. Scaled so its largest channel is 1.
    tint?: string;
    // `#rrggbb` colours for the darkest and lightest tones of a grey source, instead of a tint.
    duotone?: [string, string];
    // Multiplies the saturation, keeping the hue.
    saturate?: number;
    // Geometric albedo. The map's mean brightness is scaled to follow it, see `ALBEDO_K`.
    albedo?: number;
    // Width and height of the working image, then of the output.
    work: [number, number];
    size: [number, number];
};

// Target mean luminance of a map is ALBEDO_K * sqrt(albedo), on encoded values. The square root
// compresses the range, so a dark body isn't black. The Moon's 2K map has a mean of 0.58 for an
// albedo of 0.12, which would give a k of 1.68. That puts any albedo above 0.36 past white, so k
// is 0.75 instead, which puts an albedo of 1 at a mean of 0.75.
const ALBEDO_K = 0.75;

const MOON_WORK: [number, number] = [2048, 1024];
const MOON_SIZE: [number, number] = [1024, 512];

// Pluto's source is large, so it is worked on at 4096x2048 before the final resize.
const PLUTO: Filled = {
    out: "pluto",
    source: "Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
    roll: true,
    fill: ["south"],
    tint: "#c8a593",
    work: [4096, 2048],
    size: [2048, 1024],
};

// Albedos are visual geometric albedos. The satellites' are from the NASA NSSDCA fact sheets,
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/, and Iapetus is the mean of its 0.05 and 0.5
// sides. Ceres 0.09 and Vesta 0.42 are from the JPL Small-Body Database.
// Tints are the `BODY_COLORS` in `src/view/theme.ts`, which imports three and so isn't imported here.
const MOONS: Filled[] = (
    [
        {
            out: "io",
            source: "Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif",
            // The source reads pale cream.
            saturate: 1.3,
            albedo: 0.62,
        },
        {
            out: "europa",
            source: "Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
            roll: true,
            fill: ["south"],
            tint: "#dccdb2",
            albedo: 0.68,
        },
        {
            out: "ganymede",
            source: "Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif",
            roll: true,
            fill: ["north", "south"],
            albedo: 0.44,
        },
        {
            out: "callisto",
            source: "Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif",
            roll: true,
            fill: ["south"],
            tint: "#6f6a66",
            albedo: 0.19,
        },
        {
            out: "mimas",
            source: "MI_170630_DLR_basemap_degrees.tif",
            albedo: 0.6,
        },
        {
            out: "enceladus",
            source: "Enceladus_Cassini_ISS_Global_Mosaic_100m_HPF.tif",
            roll: true,
            tint: "#eef4f7",
            albedo: 1.0,
        },
        {
            out: "tethys",
            source: "Tethys_Cassini_mosaic_global_293m.tif",
            albedo: 0.8,
        },
        {
            out: "dione",
            source: "Dione_Cassini_Voyager_mosaic_global_154m.tif",
            albedo: 0.7,
        },
        // Already centred on longitude 0: its left edge is on the 180 degree meridian.
        {
            out: "rhea",
            source: "Rhea_Cassini_Voyager_mosaic_global_417m.tif",
            albedo: 0.7,
        },
        {
            out: "iapetus",
            source: "Iapetus_Cassini_Voyager_mosaic_global_783m.tif",
            albedo: 0.28,
        },
        {
            out: "triton",
            source: "Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif",
            fill: ["north"],
            albedo: 0.72,
        },
        {
            out: "phobos",
            source: "Phobos_ME_SRC_Mosaic_Global_16ppd.tif",
            albedo: 0.07,
        },
        {
            out: "charon",
            source: "Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
            fill: ["south"],
            // The source is grey, so Mordor Macula needs its red-brown back.
            duotone: ["#5a3a2e", "#d6d2cc"],
            albedo: 0.42,
        },
        {
            out: "ceres",
            source: "Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif",
            roll: true,
            fill: ["south"],
            tint: "#a7a199",
            albedo: 0.09,
        },
        {
            out: "vesta",
            source: "Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif",
            fill: ["north"],
            tint: "#bcae9a",
            albedo: 0.42,
        },
    ] satisfies Omit<Filled, "work" | "size">[]
).map((moon) => ({ ...moon, work: MOON_WORK, size: MOON_SIZE }));

// Jupiter's and Saturn's sources are pale and flat; this brings out their bands. Saturn keeps
// its whites, which clipped flat at white=0.95.
const LIVELIER = ["--saturate", "1.4", "--contrast:black=0.08:white=0.95"];
const LIVELIER_SATURN = [
    "--saturate",
    "1.4",
    "--contrast:black=0.08:white=1.0",
];

// Output name, source file and extra oiiotool steps. The ring keeps its alpha channel.
const MAPS: { out: string; source: string; alpha?: true; steps?: string[] }[] =
    [
        // The source is a saturated orange; the square root lifts it toward the Sun's theme colour.
        { out: "sun", source: "2k_sun.jpg", steps: ["--powc", "0.5"] },
        { out: "mercury", source: "2k_mercury.jpg" },
        { out: "venus", source: "2k_venus_atmosphere.jpg" },
        { out: "earth", source: "2k_earth_daymap.jpg" },
        { out: "earth-night", source: "2k_earth_nightmap.jpg" },
        { out: "earth-clouds", source: "2k_earth_clouds.jpg" },
        { out: "moon", source: "2k_moon.jpg" },
        // The source reads tomato-red once tone mapped.
        { out: "mars", source: "2k_mars.jpg", steps: ["--saturate", "0.85"] },
        { out: "jupiter", source: "2k_jupiter.jpg", steps: LIVELIER },
        { out: "saturn", source: "2k_saturn.jpg", steps: LIVELIER_SATURN },
        { out: "saturn-ring", source: "2k_saturn_ring_alpha.png", alpha: true },
        { out: "uranus", source: "2k_uranus.jpg" },
        { out: "neptune", source: "2k_neptune.jpg" },
    ];

const [directory, ...flags] = Deno.args;
const onlyMoons = flags.includes("--moons");
if (!directory || flags.some((flag) => flag !== "--moons")) {
    console.error("Usage: build-maps.ts <directory> [--moons]");
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

const encode = (
    input: string,
    channels: string,
    out: string,
    steps: string[] = [],
): Promise<void> =>
    oiio([
        input,
        ...steps,
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

const compression = ["-d", "uint8", "--attrib", "Compression", "webp:85"];

const widthOf = async (path: string): Promise<number> => {
    const { code, stdout } = await new Deno.Command("oiiotool", {
        args: ["--info", path],
        stdout: "piped",
    }).output();
    const match = /: (\d+) x \d+/.exec(new TextDecoder().decode(stdout));
    if (code !== 0 || !match)
        throw new Error(`Couldn't read the size of ${path}.`);

    return Number(match[1]);
};

const buildFilled = async (
    {
        out,
        source,
        roll,
        fill = [],
        tint: colour,
        duotone: duo,
        saturate: saturation,
        albedo,
        work,
        size,
    }: Filled,
    temp: string,
): Promise<void> => {
    const [workWidth, workHeight] = work;
    const input = `${temp}/${out}.pnm`;
    const output = `${temp}/${out}-out.ppm`;
    const sourcePath = `${directory}/${source}`;

    await oiio([
        sourcePath,
        // Rolling by half the width puts longitude 0 at the centre, like the other maps.
        ...(roll
            ? ["--cshift", `+${Math.floor((await widthOf(sourcePath)) / 2)}+0`]
            : []),
        "--resize",
        `${workWidth}x${workHeight}`,
        // oiiotool 3.2 writes PNM rows bottom-up, so flip to get them top-down.
        "--flip",
        "-o",
        input,
    ]);

    const { width, height, channels, data } = parsePnm(
        await Deno.readFile(input),
    );
    if (channels === 3 && colour)
        throw new Error(`The map of ${out} is colour, so it can't be tinted.`);
    if (channels === 3 && duo)
        throw new Error(
            `The map of ${out} is colour, so it can't be a duotone.`,
        );
    if (colour && duo)
        throw new Error(`The map of ${out} has both a tint and a duotone.`);

    const isDark = (x: number, y: number): boolean => {
        for (let c = 0; c < channels; c++) {
            if (data[(y * width + x) * channels + c] >= UNIMAGED_BELOW)
                return false;
        }

        return true;
    };
    // The share of unimaged pixels in the outer tenth of the map on one side.
    const unimagedShare = (side: Side): number => {
        const band = Math.floor(height / 10);
        const first = side === "north" ? 0 : height - band;
        let count = 0;
        for (let y = first; y < first + band; y++) {
            for (let x = 0; x < width; x++) {
                if (isDark(x, y)) count++;
            }
        }

        return count / (band * width);
    };
    for (const side of fill) {
        const other = side === "north" ? "south" : "north";
        if (unimagedShare(side) <= 0.01) {
            throw new Error(
                `The map of ${out} has no unimaged band in the ${side}. Is it upside down?`,
            );
        }
        // Real dark pixels give the other side a small share, so only a larger one is an error.
        if (fill.length === 1 && unimagedShare(other) > unimagedShare(side)) {
            throw new Error(
                `The map of ${out} is upside down: the unimaged band should be in the ${side}.`,
            );
        }
    }

    let filled = data;
    for (const side of fill)
        filled = mirrorFill(filled, width, height, { channels, side });

    let rgb =
        channels === 3
            ? filled
            : duo
              ? duotone(filled, rgbFromHex(duo[0]), rgbFromHex(duo[1]))
              : tint(filled, colour ? tintFromHex(colour) : [1, 1, 1]);
    if (saturation) rgb = saturate(rgb, saturation);
    if (albedo !== undefined) {
        const before = luminanceMean(rgb);
        rgb = scaleToMean(rgb, ALBEDO_K * Math.sqrt(Math.min(albedo, 1)));
        console.log(
            `${out}: mean ${before.toFixed(3)} -> ${luminanceMean(rgb).toFixed(3)}`,
        );
    }

    await Deno.writeFile(
        output,
        encodePnm({ width, height, channels: 3, data: rgb }),
    );

    const name = `${out}.webp`;
    await oiio([
        output,
        "--resize",
        `${size[0]}x${size[1]}`,
        ...compression,
        "-o",
        fileURLToPath(new URL(name, maps)),
    ]);
    await report(name);
};

if (!onlyMoons) {
    for (const { out, source, alpha, steps } of MAPS) {
        const name = `${out}.webp`;
        await encode(
            `${directory}/${source}`,
            alpha ? "R,G,B,A" : "R,G,B",
            fileURLToPath(new URL(name, maps)),
            steps,
        );
        await report(name);
    }
}

const temp = await Deno.makeTempDir();
try {
    for (const map of onlyMoons ? MOONS : [PLUTO, ...MOONS])
        await buildFilled(map, temp);
} finally {
    await Deno.remove(temp, { recursive: true });
}
