import {
    cross,
    DAY,
    dot,
    EARTH_RADIUS,
    G,
    normalize,
    OBLIQUITY_J2000,
    solveKepler,
    unixMsToJ2000s,
    wrapAngle,
} from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertGreater,
} from "@std/assert";
import type { Catalogue } from "../catalogue.ts";
import { bodyOrientation } from "../orientation.ts";
import { j2Precession } from "../precession.ts";
import { SNAPSHOT_WINDOW } from "../swarm.ts";
import { type CloudHost, prepareCloud } from "./cloud.ts";

const MU = G * 5.97217e24;
const SIN_OBLIQUITY = Math.sin(OBLIQUITY_J2000);
const COS_OBLIQUITY = Math.cos(OBLIQUITY_J2000);

// WGS 84 / EGM2008, as in the catalog's Earth preset.
const EARTH_GRAVITY = { j2: 1.08262668e-3, radius: EARTH_RADIUS };
const EARTH: CloudHost = {
    mu: MU,
    radius: EARTH_RADIUS,
    // Earth's J2000 pole in ecliptic axes.
    rotation: {
        type: "uniform",
        pole: { x: 0, y: SIN_OBLIQUITY, z: COS_OBLIQUITY },
        w0: 0,
        rate: 7.2921159e-5,
    },
    gravity: EARTH_GRAVITY,
};

const MARS_POLE = normalize({ x: 0.3, y: -0.4, z: 0.86 });
const MARS_MU = 4.282837e13;
const MARS_GRAVITY = { j2: 1.96045e-3, radius: 3.3962e6 };
const MARS: CloudHost = {
    mu: MARS_MU,
    radius: 3.3895e6,
    rotation: { type: "uniform", pole: MARS_POLE, w0: 0, rate: 7.088e-5 },
    gravity: MARS_GRAVITY,
};

const EPOCH_MS = Date.UTC(2026, 10, 23, 12);
const EPOCH = unixMsToJ2000s(EPOCH_MS);

type Sat = {
    a?: number;
    e?: number;
    i?: number;
    raan?: number;
    argp?: number;
    m0?: number;
};

const catalogue = (sats: Sat[], mu = MU): Catalogue => {
    const elements = new Float32Array(sats.length * 7);
    sats.forEach((sat, k) => {
        elements.set(
            [
                0,
                Math.sqrt(mu / (sat.a ?? 7e6) ** 3),
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
        groups: new Uint8Array(sats.length),
        elements,
    };
};

const positionAt = (
    sat: Sat,
    t: number,
    host: CloudHost = EARTH,
): [number, number, number] => {
    const out = new Float64Array(3);
    prepareCloud(catalogue([sat], host.mu), host).positionsAt(
        t,
        Uint32Array.of(0),
        out,
    );

    return [out[0] as number, out[1] as number, out[2] as number];
};

/** A reference propagation with Earth's equator at +z, rotated by the obliquity into the ecliptic. */
const fixedFramePositions = (cat: Catalogue, t: number): Float64Array => {
    const epoch = unixMsToJ2000s(cat.epoch);
    const out = new Float64Array(cat.groups.length * 3);

    for (let k = 0; k < cat.groups.length; k++) {
        const [dt, n, e, i, raan0, argp0, m0] = cat.elements.subarray(
            k * 7,
            k * 7 + 7,
        ) as unknown as number[] as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
        ];
        const a = (MU / n ** 2) ** (1 / 3);
        const t0 = epoch + dt;
        const { nodeRate, argpRate } = j2Precession(
            { a, e, i, raan: raan0, argp: argp0, m0, epoch: t0 },
            MU,
            EARTH_GRAVITY.j2,
            EARTH_GRAVITY.radius,
            { x: 0, y: 0, z: 1 },
        );
        const ea = solveKepler(wrapAngle(m0 + n * (t - t0)), e);

        const x = a * (Math.cos(ea) - e);
        const y = a * Math.sqrt(1 - e * e) * Math.sin(ea);
        const argp = argp0 + argpRate * (t - t0);
        const raan = raan0 + nodeRate * (t - t0);
        const u = x * Math.cos(argp) - y * Math.sin(argp);
        const v = x * Math.sin(argp) + y * Math.cos(argp);
        const vy = v * Math.cos(i);
        const eqX = u * Math.cos(raan) - vy * Math.sin(raan);
        const eqY = u * Math.sin(raan) + vy * Math.cos(raan);
        const eqZ = v * Math.sin(i);

        out[k * 3] = eqX / 1000;
        out[k * 3 + 1] = (eqY * COS_OBLIQUITY + eqZ * SIN_OBLIQUITY) / 1000;
        out[k * 3 + 2] = (-eqY * SIN_OBLIQUITY + eqZ * COS_OBLIQUITY) / 1000;
    }

    return out;
};

Deno.test("an Earth cloud matches a fixed-frame propagation to a metre", () => {
    const cat = catalogue([
        { a: 6.9e6 },
        { a: 7.2e6, e: 0.02, i: 0.9, raan: 1, argp: 2, m0: 3 },
        { a: 42_164e3, i: 0.01, m0: 4 },
        { a: 2.6e7, e: 0.7, i: 1.1, raan: 2, argp: 4.5, m0: 1 },
        { a: 7e6, e: 0.001, i: 2.6, raan: 5, argp: 0.3, m0: 6 },
    ]);
    const cloud = prepareCloud(cat, EARTH);
    const shown = Uint32Array.from({ length: cloud.count }, (_, k) => k);

    for (const dt of [
        0,
        -SNAPSHOT_WINDOW,
        SNAPSHOT_WINDOW,
        1234,
        3 * DAY,
        -40 * DAY,
        200 * DAY,
    ]) {
        const t = EPOCH + dt;
        const out = new Float64Array(cloud.count * 3);
        cloud.positionsAt(t, shown, out);
        const expected = fixedFramePositions(cat, t);

        for (let s = 0; s < out.length; s++) {
            assertAlmostEquals(out[s] as number, expected[s] as number, 1e-3);
        }
    }
});

Deno.test("a circular equatorial orbit lies at its radius in Earth's equatorial plane", () => {
    const a = 7e6;

    for (const m0 of [0, 1, 2.5, 4]) {
        const [x, y, z] = positionAt({ a, m0 }, EPOCH + 1234);

        assertAlmostEquals(Math.hypot(x, y, z), a / 1000, 1e-2);
        // Earth's pole in ecliptic axes is (0, sin ε, cos ε); the orbit is normal to it.
        assertAlmostEquals(y * SIN_OBLIQUITY + z * COS_OBLIQUITY, 0, 1e-2);
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
    assertAlmostEquals(y * COS_OBLIQUITY - z * SIN_OBLIQUITY, 0, 1e-2);
    assertAlmostEquals(y * SIN_OBLIQUITY + z * COS_OBLIQUITY, 7000, 1e-2);
});

Deno.test("a node at 90 degrees puts the satellite on the equatorial y axis", () => {
    const [x, y, z] = positionAt(
        { a: 7e6, i: 0.5, raan: Math.PI / 2, argp: 0, m0: 0 },
        EPOCH,
    );

    assertAlmostEquals(x, 0, 1e-2);
    assertAlmostEquals(y * COS_OBLIQUITY - z * SIN_OBLIQUITY, 7000, 1e-2);
    assertAlmostEquals(y * SIN_OBLIQUITY + z * COS_OBLIQUITY, 0, 1e-2);
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

Deno.test("a short buffer takes only what fits", () => {
    const cloud = prepareCloud(catalogue([{}, {}, {}]), EARTH);
    const shown = Uint32Array.of(0, 1, 2);

    assertEquals(cloud.positionsAt(EPOCH, shown, new Float32Array(6)), 2);
});

Deno.test("slot j holds the particle shown[j]", () => {
    const cloud = prepareCloud(catalogue([{ a: 6.9e6 }, { a: 7.2e6 }]), EARTH);
    const out = new Float64Array(3);

    assertEquals(cloud.positionsAt(EPOCH, Uint32Array.of(1), out), 1);
    assertAlmostEquals(Math.hypot(...out), 7200, 1e-2);
});

Deno.test("a host without gravity gives satellites that don't precess", () => {
    const sat = { a: 7.2e6, e: 0.02, i: 0.9, raan: 1, argp: 2, m0: 3 };
    const host = { mu: MU, radius: EARTH_RADIUS, rotation: EARTH.rotation };
    const n = Math.sqrt(MU / sat.a ** 3);
    const start = positionAt(sat, EPOCH, host);
    const later = positionAt(sat, EPOCH + (2 * Math.PI) / n, host);

    assertAlmostEquals(later[0], start[0], 1e-2);
    assertAlmostEquals(later[1], start[1], 1e-2);
    assertAlmostEquals(later[2], start[2], 1e-2);
});

/** The unit normal of the orbit of particle 0 at `t`, in the host's equatorial frame given by pole `p`. */
const orbitNode = (
    cat: Catalogue,
    host: CloudHost,
    t: number,
    p: { x: number; y: number; z: number },
): number => {
    const loop = prepareCloud(cat, host).orbitAt(0, t, 4);
    const at = (s: number) => ({
        x: loop[s * 3] as number,
        y: loop[s * 3 + 1] as number,
        z: loop[s * 3 + 2] as number,
    });
    const normal = cross(at(0), at(1));
    const x = normalize(cross(p, { x: 0, y: 0, z: 1 }));
    const y = cross(p, x);

    // The normal of a plane with node Ω and inclination i is (sin i sin Ω, -sin i cos Ω, cos i).
    return Math.atan2(dot(normal, x), -dot(normal, y));
};

Deno.test("the node precesses at the J2 rate about the pole", () => {
    const sat = { a: 7.2e6, e: 0, i: 0.9, raan: 1, argp: 2, m0: 3 };
    const cat = catalogue([sat]);
    const cloud = prepareCloud(cat, EARTH);
    const expected = j2Precession(
        {
            a: cloud.a[0] as number,
            e: 0,
            i: Math.fround(sat.i),
            raan: 1,
            argp: 2,
            m0: 3,
            epoch: EPOCH,
        },
        MU,
        EARTH_GRAVITY.j2,
        EARTH_GRAVITY.radius,
        { x: 0, y: 0, z: 1 },
    );
    const pole = { x: 0, y: SIN_OBLIQUITY, z: COS_OBLIQUITY };

    const start = orbitNode(cat, EARTH, EPOCH, pole);
    const later = orbitNode(cat, EARTH, EPOCH + DAY, pole);

    assertAlmostEquals(start, 1, 1e-5);
    assertAlmostEquals((later - start) / DAY, expected.nodeRate, 1e-9);
    // A prograde orbit regresses.
    assert(expected.nodeRate < 0);
});

Deno.test("an orbit stays between its perigee and apogee and closes", () => {
    const sat = { a: 2.6e7, e: 0.6, i: 1, raan: 0.5, argp: 1, m0: 2 };
    const cloud = prepareCloud(catalogue([sat]), EARTH);
    const a = (cloud.a[0] as number) / 1000;
    const e = cloud.e[0] as number;

    const orbit = cloud.orbitAt(0, EPOCH + 5000, 64);

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
    const cloud = prepareCloud(catalogue([sat]), EARTH);
    const t = EPOCH + 3 * DAY;
    const position = new Float32Array(3);
    cloud.positionsAt(t, Uint32Array.of(0), position);

    const orbit = cloud.orbitAt(0, t, 720);

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

Deno.test("a Mars cloud is read relative to Mars's equator", () => {
    const pole = bodyOrientation(MARS.rotation, EPOCH)?.z;
    assert(pole);
    assertAlmostEquals(pole.x, MARS_POLE.x, 1e-9);
    assertAlmostEquals(pole.y, MARS_POLE.y, 1e-9);
    assertAlmostEquals(pole.z, MARS_POLE.z, 1e-9);
    const a = 4e6;

    for (const m0 of [0, 1, 2.5, 4]) {
        const [x, y, z] = positionAt({ a, m0 }, EPOCH + 1234, MARS);

        assertAlmostEquals(Math.hypot(x, y, z), a / 1000, 1e-2);
        assertAlmostEquals(x * pole.x + y * pole.y + z * pole.z, 0, 1e-2);
    }
});

Deno.test("a satellite at its node at the epoch lies on the ecliptic's node on the host's equator", () => {
    const node = normalize(cross(MARS_POLE, { x: 0, y: 0, z: 1 }));

    const [x, y, z] = positionAt({ a: 4e6, i: 0.5 }, EPOCH, MARS);

    assertAlmostEquals(x, node.x * 4000, 1e-2);
    assertAlmostEquals(y, node.y * 4000, 1e-2);
    assertAlmostEquals(z, node.z * 4000, 1e-2);
});

Deno.test("a node a quarter turn along Mars's equator lies on the pole crossed with the first node", () => {
    const node = normalize(cross(MARS_POLE, { x: 0, y: 0, z: 1 }));
    const quarter = cross(MARS_POLE, node);

    const [x, y, z] = positionAt(
        { a: 4e6, i: Math.PI / 2, raan: Math.PI / 2 },
        EPOCH,
        MARS,
    );

    assertAlmostEquals(x, quarter.x * 4000, 1e-2);
    assertAlmostEquals(y, quarter.y * 4000, 1e-2);
    assertAlmostEquals(z, quarter.z * 4000, 1e-2);
});

Deno.test("a prograde Mars orbit turns the same way as Mars", () => {
    const [x0, y0, z0] = positionAt({ a: 4e6, i: 0.5 }, EPOCH, MARS);
    const [x1, y1, z1] = positionAt({ a: 4e6, i: 0.5 }, EPOCH + 60, MARS);

    const normal = cross({ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 });

    assertGreater(dot(normal, MARS_POLE), 0);
});

Deno.test("a Mars node precesses at the J2 rate of Mars", () => {
    const sat = { a: 4e6, e: 0, i: 0.5, raan: 1, argp: 0, m0: 0 };
    const cat = catalogue([sat], MARS_MU);
    const cloud = prepareCloud(cat, MARS);
    const expected = j2Precession(
        {
            a: cloud.a[0] as number,
            e: 0,
            i: Math.fround(sat.i),
            raan: 1,
            argp: 0,
            m0: 0,
            epoch: EPOCH,
        },
        MARS_MU,
        MARS_GRAVITY.j2,
        MARS_GRAVITY.radius,
        { x: 0, y: 0, z: 1 },
    );

    const start = orbitNode(cat, MARS, EPOCH, MARS_POLE);
    const later = orbitNode(cat, MARS, EPOCH + DAY, MARS_POLE);

    assertAlmostEquals(start, 1, 1e-5);
    assertAlmostEquals((later - start) / DAY, expected.nodeRate, 1e-9);
    assert(expected.nodeRate < 0);
});

Deno.test("a host without rotation uses the ecliptic axes", () => {
    const host = { mu: MU, radius: EARTH_RADIUS };

    for (const m0 of [0, 1, 2.5]) {
        const [, , z] = positionAt({ a: 7e6, m0 }, EPOCH + 99, host);

        assertAlmostEquals(z, 0, 1e-2);
    }

    const [x, y, z] = positionAt({ a: 7e6, i: 1 }, EPOCH, host);

    assertAlmostEquals(x, 7000, 1e-2);
    assertAlmostEquals(y, 0, 1e-2);
    assertAlmostEquals(z, 0, 1e-2);
});

Deno.test("a host without rotation puts a quarter-turn node on the ecliptic y axis", () => {
    const host = { mu: MU, radius: EARTH_RADIUS };

    const [x, y, z] = positionAt({ a: 7e6, raan: Math.PI / 2 }, EPOCH, host);

    assertAlmostEquals(x, 0, 1e-2);
    assertAlmostEquals(y, 7000, 1e-2);
    assertAlmostEquals(z, 0, 1e-2);
});
