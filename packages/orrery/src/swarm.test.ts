import { EARTH_J2 } from "@cpluspatch/catalog";
import {
    DAY,
    EARTH_RADIUS,
    G,
    OBLIQUITY_J2000,
    unixMsToJ2000s,
} from "@cpluspatch/orbit";
import { j2Precession } from "@cpluspatch/sim";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertGreater,
} from "@std/assert";
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
    satelliteOrbit,
    selectShown,
    snapshotGap,
    writePositions,
} from "./swarm.ts";

const MU = G * 5.97217e24;
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

const positionAt = (sat: Sat, t: number): [number, number, number] => {
    const swarm = prepareSwarm(catalogue([sat]), MU);
    const out = new Float32Array(3);
    writePositions(swarm, Uint32Array.of(0), t, out);

    return [out[0] as number, out[1] as number, out[2] as number];
};

Deno.test("a circular equatorial orbit lies at its radius in Earth's equatorial plane", () => {
    const a = 7e6;

    for (const m0 of [0, 1, 2.5, 4]) {
        const [x, y, z] = positionAt({ a, m0 }, EPOCH + 1234);

        assertAlmostEquals(Math.hypot(x, y, z), a / 1000, 1e-2);
        // Earth's pole in ecliptic axes is (0, sin ε, cos ε); the orbit is normal to it.
        assertAlmostEquals(
            y * Math.sin(OBLIQUITY_J2000) + z * Math.cos(OBLIQUITY_J2000),
            0,
            1e-2,
        );
    }
});

Deno.test("a satellite at the ascending node starts on the ecliptic x axis", () => {
    const [x, y, z] = positionAt(
        { a: 7e6, i: 1, raan: 0, argp: 0, m0: 0 },
        EPOCH,
    );

    assertAlmostEquals(x, 7000, 1e-2);
    assertAlmostEquals(y, 0, 1e-2);
    assertAlmostEquals(z, 0, 1e-2);
});

Deno.test("a polar satellite a quarter turn past the node sits over the north pole", () => {
    const [x, y, z] = positionAt(
        { a: 7e6, i: Math.PI / 2, raan: 0, argp: 0, m0: Math.PI / 2 },
        EPOCH,
    );

    assertAlmostEquals(x, 0, 1e-2);
    assertAlmostEquals(
        y * Math.cos(OBLIQUITY_J2000) - z * Math.sin(OBLIQUITY_J2000),
        0,
        1e-2,
    );
    assertAlmostEquals(
        y * Math.sin(OBLIQUITY_J2000) + z * Math.cos(OBLIQUITY_J2000),
        7000,
        1e-2,
    );
});

Deno.test("a node at 90 degrees puts the satellite on the equatorial y axis", () => {
    const [x, y, z] = positionAt(
        { a: 7e6, i: 0.5, raan: Math.PI / 2, argp: 0, m0: 0 },
        EPOCH,
    );

    assertAlmostEquals(x, 0, 1e-2);
    assertAlmostEquals(
        y * Math.cos(OBLIQUITY_J2000) - z * Math.sin(OBLIQUITY_J2000),
        7000,
        1e-2,
    );
    assertAlmostEquals(
        y * Math.sin(OBLIQUITY_J2000) + z * Math.cos(OBLIQUITY_J2000),
        0,
        1e-2,
    );
});

Deno.test("after one period a satellite is back where it started", () => {
    const sat = { a: 7e6, e: 0.01, i: 0.9, raan: 1, argp: 2, m0: 3 };
    const n = Math.sqrt(MU / sat.a ** 3);
    const start = positionAt(sat, EPOCH);
    const later = positionAt(sat, EPOCH + (2 * Math.PI) / n);
    const half = positionAt(sat, EPOCH + Math.PI / n);

    // J2 moves the plane by about 40 km over one LEO period.
    assertAlmostEquals(later[0], start[0], 70);
    assertAlmostEquals(later[1], start[1], 70);
    assertAlmostEquals(later[2], start[2], 70);
    assertGreater(
        Math.hypot(...half.map((v, i) => v - (start[i] as number))),
        10_000,
    );
});

Deno.test("the node and periapsis rates are the J2 ones about the pole", () => {
    const sat = { a: 7.2e6, e: 0.02, i: 0.9, raan: 1, argp: 2, m0: 3 };
    const swarm = prepareSwarm(catalogue([sat]), MU);
    const expected = j2Precession(
        {
            a: swarm.a[0] as number,
            e: sat.e,
            i: Math.fround(sat.i),
            raan: 1,
            argp: 2,
            m0: 3,
            epoch: EPOCH,
        },
        MU,
        EARTH_J2,
        EARTH_RADIUS,
        { x: 0, y: 0, z: 1 },
    );

    assertAlmostEquals(swarm.nodeRate[0] as number, expected.nodeRate, 1e-12);
    assertAlmostEquals(swarm.argpRate[0] as number, expected.argpRate, 1e-12);
    // A prograde orbit regresses.
    assert((swarm.nodeRate[0] as number) < 0);
});

Deno.test("a semi-major axis comes from the mean motion", () => {
    const swarm = prepareSwarm(catalogue([{ a: 26_560e3 }]), MU);

    assertAlmostEquals((swarm.a[0] as number) / 1000, 26_560, 1e-2);
    assertEquals(swarm.classes, ["meo"]);
});

Deno.test("the orbit classes follow the orbit", () => {
    const swarm = prepareSwarm(
        catalogue([{ a: 6.9e6 }, { a: 42_164e3 }, { a: 2.6e7, e: 0.7 }]),
        MU,
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
        MU,
    );

    assertEquals(Array.from(selectShown(swarm, new Set())), []);
    const shown = selectShown(
        swarm,
        new Set<SatelliteGroup>(["starlink", "other"]),
    );
    assertEquals(Array.from(shown), [0, 1, 3]);

    const out = new Float32Array(4 * 3).fill(-1);
    const count = writePositions(swarm, shown, EPOCH, out);

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

Deno.test("a short buffer takes only what fits", () => {
    const swarm = prepareSwarm(catalogue([{}, {}, {}]), MU);
    const shown = selectShown(swarm, new Set(["other"]));

    assertEquals(writePositions(swarm, shown, EPOCH, new Float32Array(6)), 2);
});

Deno.test("the snapshot window is a year either side of the epoch", () => {
    const swarm = prepareSwarm(catalogue([{}]), MU);

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

Deno.test("an orbit stays between its perigee and apogee and closes", () => {
    const sat = { a: 2.6e7, e: 0.6, i: 1, raan: 0.5, argp: 1, m0: 2 };
    const swarm = prepareSwarm(catalogue([sat]), MU);
    const a = (swarm.a[0] as number) / 1000;
    const e = swarm.e[0] as number;

    const orbit = satelliteOrbit(swarm, 0, EPOCH + 5000, 64);

    assertEquals(orbit.length, 65 * 3);
    for (let s = 0; s <= 64; s++) {
        const r = Math.hypot(
            orbit[s * 3] as number,
            orbit[s * 3 + 1] as number,
            orbit[s * 3 + 2] as number,
        );
        assert(r >= a * (1 - e) - 1 && r <= a * (1 + e) + 1);
    }
    assertEquals(
        Array.from(orbit.subarray(64 * 3)),
        Array.from(orbit.subarray(0, 3)),
    );
});

Deno.test("a satellite lies on its own orbit", () => {
    const sat = { a: 7e6, e: 0.1, i: 0.9, raan: 1, argp: 2, m0: 3 };
    const swarm = prepareSwarm(catalogue([sat]), MU);
    const t = EPOCH + 3 * DAY;
    const position = new Float32Array(3);
    writePositions(swarm, Uint32Array.of(0), t, position);

    const orbit = satelliteOrbit(swarm, 0, t, 720);

    let nearest = Number.POSITIVE_INFINITY;
    for (let s = 0; s < 720; s++) {
        nearest = Math.min(
            nearest,
            Math.hypot(
                (orbit[s * 3] as number) - (position[0] as number),
                (orbit[s * 3 + 1] as number) - (position[1] as number),
                (orbit[s * 3 + 2] as number) - (position[2] as number),
            ),
        );
    }
    // The samples are about 2 * pi * a / 720 = 61 km apart.
    assertGreater(40, nearest);
});

Deno.test("a circular orbit has the same perigee, apogee and altitude", () => {
    const swarm = prepareSwarm(
        catalogue([{ group: "starlink", a: 6.93e6, i: 0.9 }]),
        MU,
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
    const swarm = prepareSwarm(catalogue([{ a: 2.6e7, e: 0.7 }]), MU);

    const facts = satelliteFacts(swarm, 0, EPOCH);

    const a = swarm.a[0] as number;
    assertAlmostEquals(facts.perigeeKm, (a * 0.3 - EARTH_RADIUS) / 1000, 1e-3);
    assertAlmostEquals(facts.apogeeKm, (a * 1.7 - EARTH_RADIUS) / 1000, 1e-3);
    assertEquals(facts.orbitClass, "heo");
});
