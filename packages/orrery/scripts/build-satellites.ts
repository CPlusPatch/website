/// <reference types="deno" />
/**
 * @module
 * Builds the Orrery's satellite snapshot: `src/assets/satellites.bin`.
 *
 * Source: CelesTrak's "active" group as OMM CSV, https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv
 *
 * CelesTrak asks for at most one download per group every 2 hours, so keep the file.
 *
 * Credits: CelesTrak (Dr T.S. Kelso).
 *
 * Run it from the repository root:
 *
 *   curl -o active.csv 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv'
 *   deno run --allow-read --allow-write packages/orrery/scripts/build-satellites.ts active.csv
 */

import { CURATED_CATALOG_NUMBERS } from "@cpluspatch/orbit";
import {
    type CatalogueEntry,
    encodeCatalogue,
    SATELLITE_GROUPS,
} from "../src/catalogue.ts";
import { parseOmmCsv, satelliteGroup } from "./celestrak.ts";

const [csv] = Deno.args;
if (!csv) {
    console.error("Usage: build-satellites.ts <active.csv>");
    Deno.exit(2);
}

const assets = new URL("../src/assets/", import.meta.url);
await Deno.mkdir(assets, { recursive: true });

// These are already bodies in the orrery.
const curated = new Set(CURATED_CATALOG_NUMBERS);
const entries: CatalogueEntry[] = parseOmmCsv(await Deno.readTextFile(csv))
    .filter((record) => !curated.has(record.norad))
    .map((record) => ({
        name: record.name,
        group: satelliteGroup(record.name),
        epoch: record.epoch,
        meanMotion: (record.meanMotion * 2 * Math.PI) / 86400,
        eccentricity: record.eccentricity,
        inclination: record.inclination,
        raan: record.raan,
        argp: record.argp,
        m0: record.m0,
    }));

if (entries.length === 0) {
    console.error(`${csv} has no satellites.`);
    Deno.exit(1);
}

const path = new URL("satellites.bin", assets);
await Deno.writeFile(path, encodeCatalogue(entries));

for (const group of SATELLITE_GROUPS) {
    const count = entries.filter((entry) => entry.group === group).length;
    console.log(`${group}: ${count}`);
}
const epoch = Math.max(...entries.map((entry) => entry.epoch));
console.log(`snapshot ${new Date(epoch).toISOString()}`);
console.log(
    `${entries.length} satellites, ${(await Deno.stat(path)).size} bytes`,
);
