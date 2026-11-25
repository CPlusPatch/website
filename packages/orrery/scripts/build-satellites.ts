/// <reference types="deno" />
/**
 * @module
 * Builds the Orrery's satellite snapshot: `src/assets/satellites.bin`, and
 * `src/catalogue-snapshot.ts` with its group counts by orbit class, and date.
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

import { CURATED_CATALOG_NUMBERS, solarSystem } from "@cpluspatch/catalog";
import {
    type CatalogueEntry,
    decodeCatalogue,
    encodeCatalogue,
    type OrbitClass,
    prepareSwarm,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "@cpluspatch/sim";
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

// The view takes Earth's mu from the same scenario.
const earthMu = solarSystem.bodies.find((body) => body.id === "earth")?.mass.mu;
if (earthMu === undefined) {
    console.error("The solar system has no Earth.");
    Deno.exit(1);
}

const CLASSES: OrbitClass[] = ["leo", "meo", "geo", "heo"];
const counts = Object.fromEntries(
    SATELLITE_GROUPS.map((group) => [
        group,
        Object.fromEntries(CLASSES.map((cls) => [cls, 0])),
    ]),
) as Record<SatelliteGroup, Record<OrbitClass, number>>;
// Through the file, so float32 rounding can't move a satellite across a class boundary.
const swarm = prepareSwarm(decodeCatalogue(encodeCatalogue(entries)), earthMu);
for (let k = 0; k < swarm.count; k++) {
    const index = swarm.groups[k];
    const group = index === undefined ? undefined : SATELLITE_GROUPS[index];
    const cls = swarm.classes[k];
    if (group === undefined || cls === undefined)
        throw new Error(`Satellite ${k} has no group or class.`);

    counts[group][cls]++;
}

const total = (group: SatelliteGroup): number =>
    CLASSES.reduce((sum, cls) => sum + counts[group][cls], 0);
for (const group of SATELLITE_GROUPS) console.log(`${group}: ${total(group)}`);

// The fetch day, not the header epoch: some epochs are predicted and run later.
const today = new Date();
// Not `toLocaleString`, as en-GB abbreviates September to "Sept".
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const date = `${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`;
const epoch = Math.max(...entries.map((entry) => entry.epoch));
const lines = SATELLITE_GROUPS.map(
    (group) =>
        `    ${JSON.stringify(group)}: { ${CLASSES.map((cls) => `${cls}: ${counts[group][cls]}`).join(", ")} },`,
);
await Deno.writeTextFile(
    new URL("../src/catalogue-snapshot.ts", import.meta.url),
    `/**
 * @module
 * What the satellite snapshot holds. Written by \`scripts/build-satellites.ts\`: don't edit by hand.
 */

import type { OrbitClass, SatelliteGroup } from "@cpluspatch/sim";

/** The satellites in each group of \`assets/satellites.bin\`, by orbit class. */
export const GROUP_CLASSES: Record<SatelliteGroup, Record<OrbitClass, number>> = {
${lines.join("\n")}
};

/** The day the snapshot was fetched from CelesTrak. */
export const SNAPSHOT_DATE = "${date}";

/** The latest element epoch in unix ms, which the ±1 year window is measured from. */
export const SNAPSHOT_EPOCH = ${epoch};
`,
);

console.log(`snapshot ${new Date(epoch).toISOString()}`);
console.log(
    `${entries.length} satellites, ${(await Deno.stat(path)).size} bytes`,
);
