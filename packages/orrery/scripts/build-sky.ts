/// <reference types="deno" />
/**
 * @module
 * Builds the Orrery's sky assets: `src/assets/stars.bin` and `src/assets/milky-way.webp`.
 *
 * Sources:
 * - Yale Bright Star Catalogue (BSC5): http://tdc-www.harvard.edu/catalogs/BSC5
 * - NASA SVS 4851, "Deep Star Maps 2020", `milkyway_2020_4k.exr`: https://svs.gsfc.nasa.gov/4851
 *
 * Credits: NASA/Goddard Space Flight Center Scientific Visualization Studio, with Gaia data
 * from ESA/Gaia/DPAC. Stars from the Yale Bright Star Catalogue.
 *
 * Needs oiiotool. Run it from the repository root:
 *
 *   deno run --allow-read --allow-write --allow-run=oiiotool packages/orrery/scripts/build-sky.ts <BSC5> <milkyway_2020_4k.exr>
 */

import { fileURLToPath } from "node:url";
import { encodeStars } from "../src/stars.ts";
import { parseBsc5 } from "./bsc5.ts";

const MAX_MAG = 6.5;

const [catalogue, milkyWay] = Deno.args;
if (!catalogue || !milkyWay) {
    console.error("Usage: build-sky.ts <BSC5> <milkyway_2020_4k.exr>");
    Deno.exit(2);
}

const assets = new URL("../src/assets/", import.meta.url);
await Deno.mkdir(assets, { recursive: true });

const stars = parseBsc5(await Deno.readFile(catalogue)).filter(
    (star) => star.mag <= MAX_MAG,
);
const starsPath = new URL("stars.bin", assets);
await Deno.writeFile(starsPath, encodeStars(stars));
console.log(
    `${stars.length} stars, ${(await Deno.stat(starsPath)).size} bytes`,
);

const texturePath = new URL("milky-way.webp", assets);
const { code, stderr } = await new Deno.Command("oiiotool", {
    args: [
        milkyWay,
        "--resize",
        "4096x2048",
        "--tocolorspace",
        "sRGB",
        "--ch",
        "R,G,B",
        "-d",
        "uint8",
        "--attrib",
        "Compression",
        "webp:85",
        "-o",
        fileURLToPath(texturePath),
    ],
    stderr: "piped",
}).output();
if (code !== 0) {
    console.error(new TextDecoder().decode(stderr));
    Deno.exit(code);
}
console.log(`milky-way.webp, ${(await Deno.stat(texturePath)).size} bytes`);
