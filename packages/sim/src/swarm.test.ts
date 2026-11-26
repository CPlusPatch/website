import {
    EARTH_RADIUS,
    G,
    OBLIQUITY_J2000,
    unixMsToJ2000s,
} from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
    type Catalogue,
    SATELLITE_GROUPS,
    type SatelliteGroup,
} from "./catalogue.ts";
import {
    inSnapshotWindow,
    prepareSwarm,
    SNAPSHOT_WINDOW,
    satelliteFacts,
    selectShown,
    snapshotGap,
} from "./swarm.ts";

const MU = G * 5.97217e24;

// WGS 84 / EGM2008, as in the catalog's Earth preset.
const EARTH_GRAVITY = { j2: 1.08262668e-3, radius: EARTH_RADIUS };
// Earth's J2000 pole in ecliptic axes. The sidereal rate, which puts the geosynchronous radius at about 42,164 km.
const EARTH_ROTATION = {
    type: "uniform",
    pole: { x: 0, y: Math.sin(OBLIQUITY_J2000), z: Math.cos(OBLIQUITY_J2000) },
    w0: 0,
    rate: 7.2921159e-5,
} as const;
const HOST = {
    mu: MU,
    radius: EARTH_RADIUS,
    rotation: EARTH_ROTATION,
    gravity: EARTH_GRAVITY,
};
const EPOCH_MS = Date.UTC(2026, 10, 23, 12);
const EPOCH = unixMsToJ2000s(EPOCH_MS);

type Sat = {
    group?: SatelliteGroup;
    a?: number;
    e?: number;
    i?: number;
    raan?: number;
    argp?: number;
    m0?: number;
};

const catalogue = (sats: Sat[]): Catalogue => {
    const elements = new Float32Array(sats.length * 7);
    sats.forEach((sat, k) => {
        elements.set(
            [
                0,
                Math.sqrt(MU / (sat.a ?? 7e6) ** 3),
                sat.e ?? 0,
                sat.i ?? 0,
                sat.raan ?? 0,
                sat.argp ?? 0,
                sat.m0 ?? 0,
            ],
            k * 7,
        );
    });

    return {
        epoch: EPOCH_MS,
        names: sats.map((_, k) => `SAT ${k}`),
        groups: Uint8Array.from(sats, (sat) =>
            SATELLITE_GROUPS.indexOf(sat.group ?? "other"),
        ),
        elements,
    };
};

Deno.test("a semi-major axis comes from the mean motion", () => {
    const swarm = prepareSwarm(catalogue([{ a: 26_560e3 }]), HOST);

    assertAlmostEquals((swarm.a[0] as number) / 1000, 26_560, 1e-2);
    assertEquals(swarm.classes, ["meo"]);
});

Deno.test("the orbit classes follow the orbit", () => {
    const swarm = prepareSwarm(
        catalogue([{ a: 6.9e6 }, { a: 42_164e3 }, { a: 2.6e7, e: 0.7 }]),
        HOST,
    );

    assertEquals(swarm.classes, ["leo", "geo", "heo"]);
});

Deno.test("only the shown groups are written, packed first", () => {
    const swarm = prepareSwarm(
        catalogue([
            { group: "starlink", a: 6.9e6 },
            { group: "other", a: 7e6 },
            { group: "oneweb", a: 7.1e6 },
            { group: "starlink", a: 7.2e6 },
        ]),
        HOST,
    );

    assertEquals(Array.from(selectShown(swarm, new Set())), []);
    const shown = selectShown(
        swarm,
        new Set<SatelliteGroup>(["starlink", "other"]),
    );
    assertEquals(Array.from(shown), [0, 1, 3]);

    const out = new Float32Array(4 * 3).fill(-1);
    const count = swarm.positionsAt(EPOCH, shown, out);

    assertEquals(count, 3);
    [6900, 7000, 7200].forEach((radius, j) => {
        const r = Math.hypot(
            out[j * 3] as number,
            out[j * 3 + 1] as number,
            out[j * 3 + 2] as number,
        );
        assertAlmostEquals(r, radius, 1e-2);
    });
    assertEquals(Array.from(out.subarray(9)), [-1, -1, -1]);
});

Deno.test("the snapshot window is a year either side of the epoch", () => {
    const swarm = prepareSwarm(catalogue([{}]), HOST);

    assert(inSnapshotWindow(swarm, EPOCH));
    assert(inSnapshotWindow(swarm, EPOCH + SNAPSHOT_WINDOW));
    assert(inSnapshotWindow(swarm, EPOCH - SNAPSHOT_WINDOW));
    assert(!inSnapshotWindow(swarm, EPOCH + SNAPSHOT_WINDOW + 1));
    assert(!inSnapshotWindow(swarm, EPOCH - SNAPSHOT_WINDOW - 1));
});

Deno.test("the snapshot gap is 0 inside the window and signed outside it", () => {
    assertEquals(snapshotGap(EPOCH, EPOCH), 0);
    assertEquals(snapshotGap(EPOCH + SNAPSHOT_WINDOW, EPOCH), 0);
    assertEquals(snapshotGap(EPOCH - SNAPSHOT_WINDOW, EPOCH), 0);
    assertEquals(snapshotGap(EPOCH + SNAPSHOT_WINDOW + 10, EPOCH), 10);
    assertEquals(snapshotGap(EPOCH - SNAPSHOT_WINDOW - 10, EPOCH), -10);
    assertEquals(
        snapshotGap(EPOCH + 3 * SNAPSHOT_WINDOW, EPOCH),
        2 * SNAPSHOT_WINDOW,
    );
});

Deno.test("a circular orbit has the same perigee, apogee and altitude", () => {
    const swarm = prepareSwarm(
        catalogue([{ group: "starlink", a: 6.93e6, i: 0.9 }]),
        HOST,
    );

    const facts = satelliteFacts(swarm, 0, EPOCH + 1000);

    const altitude = (swarm.a[0] as number) / 1000 - EARTH_RADIUS / 1000;
    assertAlmostEquals(facts.perigeeKm, altitude, 1e-6);
    assertAlmostEquals(facts.apogeeKm, altitude, 1e-6);
    assertAlmostEquals(facts.altitudeKm, altitude, 1e-2);
    assertAlmostEquals(
        facts.periodS,
        (2 * Math.PI) / (swarm.n[0] as number),
        1e-9,
    );
    assertAlmostEquals(facts.inclination, 0.9, 1e-6);
    assertEquals(facts.name, "SAT 0");
    assertEquals(facts.group, "starlink");
    assertEquals(facts.orbitClass, "leo");
});

Deno.test("perigee and apogee of an eccentric orbit are a(1 -/+ e) above the surface", () => {
    const swarm = prepareSwarm(catalogue([{ a: 2.6e7, e: 0.7 }]), HOST);

    const facts = satelliteFacts(swarm, 0, EPOCH);

    const a = swarm.a[0] as number;
    assertAlmostEquals(facts.perigeeKm, (a * 0.3 - EARTH_RADIUS) / 1000, 1e-3);
    assertAlmostEquals(facts.apogeeKm, (a * 1.7 - EARTH_RADIUS) / 1000, 1e-3);
    assertEquals(facts.orbitClass, "heo");
});

Deno.test("altitudes are measured from the host's radius", () => {
    const radius = 3.3895e6;
    const swarm = prepareSwarm(catalogue([{ a: 4e6, e: 0.1 }]), {
        mu: MU,
        radius,
    });

    const facts = satelliteFacts(swarm, 0, EPOCH);

    assertAlmostEquals(facts.perigeeKm, (3.6e6 - radius) / 1000, 1e-3);
    assertAlmostEquals(facts.apogeeKm, (4.4e6 - radius) / 1000, 1e-3);
});
