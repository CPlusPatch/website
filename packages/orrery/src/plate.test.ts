/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { MIN_PARENT_PX, type PlateInput, plateGeometry } from "./plate.ts";

const DEG = Math.PI / 180;
const BOX = { x: 10, y: 20, width: 400, height: 300 };

const earth: PlateInput = {
    a: AU,
    e: 0.0167,
    raan: 0,
    argp: 102.9 * DEG,
    trueAnomaly: 0,
    parentRadius: 6.957e8,
    box: BOX,
    scaleMaxPx: 80,
};

const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.hypot(p.x - q.x, p.y - q.y);

Deno.test("a circular orbit is a circle around its parent", () => {
    const plate = plateGeometry({
        ...earth,
        e: 0,
        trueAnomaly: 1.2,
    });

    assertAlmostEquals(plate.rx, plate.ry, 1e-9);
    assertAlmostEquals(plate.centre.x, plate.focus.x, 1e-9);
    assertAlmostEquals(plate.centre.y, plate.focus.y, 1e-9);
    assertAlmostEquals(dist(plate.body, plate.focus), plate.rx, 1e-9);

    const radius = {
        x: plate.body.x - plate.focus.x,
        y: plate.body.y - plate.focus.y,
    };
    assertAlmostEquals(
        radius.x * plate.heading.x + radius.y * plate.heading.y,
        0,
        1e-9,
    );
    assertAlmostEquals(Math.hypot(plate.heading.x, plate.heading.y), 1, 1e-12);
});

Deno.test("an Earth-like orbit has periapsis up and to the left of the parent", () => {
    const plate = plateGeometry(earth);

    assert(plate.periapsis.x < plate.focus.x);
    assert(plate.periapsis.y < plate.focus.y);
    assert(
        plate.focus.x - plate.periapsis.x < plate.focus.y - plate.periapsis.y,
    );
    assertAlmostEquals(
        dist(plate.periapsis, plate.focus),
        AU * (1 - 0.0167) * plate.scale,
        1e-6,
    );
    assertAlmostEquals(
        dist(plate.apoapsis, plate.focus),
        AU * (1 + 0.0167) * plate.scale,
        1e-6,
    );
    assert(plate.apoapsis.x > plate.focus.x);
    assert(plate.apoapsis.y > plate.focus.y);

    // Both apsides lie on one line through the parent.
    const pe = {
        x: plate.periapsis.x - plate.focus.x,
        y: plate.periapsis.y - plate.focus.y,
    };
    const ap = {
        x: plate.apoapsis.x - plate.focus.x,
        y: plate.apoapsis.y - plate.focus.y,
    };
    assertAlmostEquals(pe.x * ap.y - pe.y * ap.x, 0, 1e-6);
});

Deno.test("the body moves counter-clockwise on screen from periapsis", () => {
    const plate = plateGeometry({ ...earth, e: 0.3, trueAnomaly: 0.1 });
    const from = {
        x: plate.periapsis.x - plate.focus.x,
        y: plate.periapsis.y - plate.focus.y,
    };
    const to = {
        x: plate.body.x - plate.focus.x,
        y: plate.body.y - plate.focus.y,
    };

    // With y down, a counter-clockwise turn has a negative cross product.
    assert(from.x * to.y - from.y * to.x < 0);
});

Deno.test("a retrograde orbit also moves counter-clockwise on screen", () => {
    // The elements carry no sense of direction, so the same input must give the same drawing.
    const plate = plateGeometry({ ...earth, argp: 0, trueAnomaly: 0.1 });

    assert(
        (plate.periapsis.x - plate.focus.x) * (plate.body.y - plate.focus.y) -
            (plate.periapsis.y - plate.focus.y) *
                (plate.body.x - plate.focus.x) <
            0,
    );
});

Deno.test("the heading follows the velocity at periapsis and apoapsis", () => {
    const pe = plateGeometry({ ...earth, e: 0.5, argp: 0 });
    const ap = plateGeometry({
        ...earth,
        e: 0.5,
        argp: 0,
        trueAnomaly: Math.PI,
    });

    // Periapsis is at +x, so counter-clockwise motion is up the screen there.
    assertAlmostEquals(pe.heading.x, 0, 1e-9);
    assertAlmostEquals(pe.heading.y, -1, 1e-9);
    assertAlmostEquals(ap.heading.x, 0, 1e-9);
    assertAlmostEquals(ap.heading.y, 1, 1e-9);
});

Deno.test("the heading is tangent to the ellipse", () => {
    const plate = plateGeometry({
        ...earth,
        e: 0.6,
        argp: 0.7,
        trueAnomaly: 2,
    });
    const phi = plate.rotation * DEG * -1;
    const dx = plate.body.x - plate.centre.x;
    const dy = plate.body.y - plate.centre.y;
    // The body's position in the ellipse's own axes, with y flipped back to maths.
    const along = dx * Math.cos(phi) - dy * Math.sin(phi);
    const across = dx * Math.sin(phi) + dy * Math.cos(phi);
    const gradient = {
        x: along / plate.rx ** 2,
        y: across / plate.ry ** 2,
    };
    const tangent = {
        x: plate.heading.x * Math.cos(phi) - plate.heading.y * Math.sin(phi),
        y: plate.heading.x * Math.sin(phi) + plate.heading.y * Math.cos(phi),
    };

    assertAlmostEquals(
        along ** 2 / plate.rx ** 2 + across ** 2 / plate.ry ** 2,
        1,
        1e-9,
    );
    assertAlmostEquals(
        gradient.x * tangent.x + gradient.y * tangent.y,
        0,
        1e-9,
    );
});

Deno.test("a high eccentricity orbit fits the box and touches its edges", () => {
    const plate = plateGeometry({ ...earth, e: 0.9, argp: 0.4 });
    const { bounds, scaleBar } = plate;

    assert(bounds.left >= BOX.x - 1e-6);
    assert(bounds.top >= BOX.y - 1e-6);
    assert(bounds.right <= BOX.x + BOX.width + 1e-6);
    assert(bounds.bottom <= BOX.y + BOX.height + 1e-6);
    assertAlmostEquals(scaleBar.y, bounds.bottom, 1e-6);
    assert(scaleBar.y <= BOX.y + BOX.height);

    const widthFits = Math.abs(bounds.right - bounds.left - BOX.width) < 1e-6;
    const heightFits = Math.abs(bounds.bottom - bounds.top - BOX.height) < 1e-6;
    assert(widthFits || heightFits);

    // The bounds are centred in the box.
    assertAlmostEquals(
        (bounds.left + bounds.right) / 2,
        BOX.x + BOX.width / 2,
        1e-6,
    );
    assertAlmostEquals(
        (bounds.top + bounds.bottom) / 2,
        BOX.y + BOX.height / 2,
        1e-6,
    );
});

Deno.test("the bounds match a sampled ellipse", () => {
    const plate = plateGeometry({ ...earth, e: 0.7, argp: 1, raan: 0.5 });
    const xs: number[] = [];
    const ys: number[] = [];

    for (let nu = 0; nu < 2 * Math.PI; nu += 0.0005) {
        const { body } = plateGeometry({
            ...earth,
            e: 0.7,
            argp: 1,
            raan: 0.5,
            trueAnomaly: nu,
        });
        xs.push(body.x);
        ys.push(body.y);
    }

    assertAlmostEquals(Math.min(...xs), plate.bounds.left, 0.05);
    assertAlmostEquals(Math.max(...xs), plate.bounds.right, 0.05);
    assertAlmostEquals(Math.min(...ys), plate.bounds.top, 0.05);
    assertAlmostEquals(Math.max(...ys), plate.bounds.bottom, 0.05);
});

Deno.test("a low orbit draws its parent to scale", () => {
    const plate = plateGeometry({
        ...earth,
        a: 6_778_000,
        e: 0.001,
        parentRadius: 6_371_000,
    });

    assertAlmostEquals(plate.parentPx, 6_371_000 * plate.scale, 1e-9);
    assert(plate.parentPx > 10 * MIN_PARENT_PX);
    assert(plate.parentPx < plate.rx);
});

Deno.test("a tiny parent is drawn at the minimum size", () => {
    const plate = plateGeometry({ ...earth, parentRadius: 1000 });

    assertEquals(plate.parentPx, MIN_PARENT_PX);
});

Deno.test("the body sits on periapsis at 0 and apoapsis at π", () => {
    const pe = plateGeometry({ ...earth, e: 0.4, trueAnomaly: 0 });
    const ap = plateGeometry({ ...earth, e: 0.4, trueAnomaly: Math.PI });

    assertAlmostEquals(pe.body.x, pe.periapsis.x, 1e-9);
    assertAlmostEquals(pe.body.y, pe.periapsis.y, 1e-9);
    assertAlmostEquals(ap.body.x, ap.apoapsis.x, 1e-9);
    assertAlmostEquals(ap.body.y, ap.apoapsis.y, 1e-9);
});

Deno.test("the ellipse is rotated clockwise by minus the longitude of periapsis", () => {
    assertAlmostEquals(
        plateGeometry({ ...earth, raan: 0, argp: 0 }).rotation,
        0,
        1e-12,
    );
    assertAlmostEquals(
        plateGeometry({ ...earth, raan: 0, argp: 90 * DEG }).rotation,
        -90,
        1e-9,
    );
    assertAlmostEquals(
        plateGeometry({ ...earth, raan: 60 * DEG, argp: 30 * DEG }).rotation,
        -90,
        1e-9,
    );
});

Deno.test("the scale bar is the largest 1, 2 or 5 × 10^k that fits", () => {
    const next = { 1: 2, 2: 5, 5: 10 } as const;

    for (const [a, scaleMaxPx] of [
        [AU, 80],
        [AU, 33],
        [5.2 * AU, 120],
        [30 * AU, 61],
        [6_778_000, 100],
        [3.84e8, 47],
        [1e5, 150],
    ] as const) {
        const { scale, scaleBar } = plateGeometry({ ...earth, a, scaleMaxPx });
        const exponent = Math.floor(Math.log10(scaleBar.metres) + 1e-9);
        const mantissa = Math.round(scaleBar.metres / 10 ** exponent);

        assert(mantissa === 1 || mantissa === 2 || mantissa === 5);
        assertAlmostEquals(scaleBar.px, scaleBar.metres * scale, 1e-9);
        assert(scaleBar.px <= scaleMaxPx);
        assert(next[mantissa] * 10 ** exponent * scale > scaleMaxPx);
    }
});
