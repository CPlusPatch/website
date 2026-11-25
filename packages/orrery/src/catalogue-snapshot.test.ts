/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import {
    decodeCatalogue,
    prepareSwarm,
    SATELLITE_GROUPS,
} from "@cpluspatch/sim";
import { assertEquals } from "@std/assert";
import { GROUP_CLASSES, SNAPSHOT_EPOCH } from "./catalogue-snapshot.ts";

Deno.test("the group classes match the snapshot file", async () => {
    const bytes = await Deno.readFile(
        new URL("./assets/satellites.bin", import.meta.url),
    );
    const mu = solarSystem.bodies.find((body) => body.id === "earth")?.mu;
    if (mu === undefined) throw new Error("The solar system has no Earth.");

    const swarm = prepareSwarm(decodeCatalogue(bytes), mu);

    const counts = Object.fromEntries(
        SATELLITE_GROUPS.map((group) => [
            group,
            { leo: 0, meo: 0, geo: 0, heo: 0 },
        ]),
    );
    for (let k = 0; k < swarm.count; k++) {
        const index = swarm.groups[k];
        const group = index === undefined ? undefined : SATELLITE_GROUPS[index];
        const tally = group === undefined ? undefined : counts[group];
        const cls = swarm.classes[k];
        if (tally === undefined || cls === undefined)
            throw new Error(`Satellite ${k} has no group or class.`);

        tally[cls]++;
    }

    assertEquals(counts, GROUP_CLASSES);
});

Deno.test("the snapshot epoch matches the snapshot file", async () => {
    const bytes = await Deno.readFile(
        new URL("./assets/satellites.bin", import.meta.url),
    );

    assertEquals(SNAPSHOT_EPOCH, decodeCatalogue(bytes).epoch);
});
