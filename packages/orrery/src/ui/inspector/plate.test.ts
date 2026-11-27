/// <reference types="deno" />
import {
    AU,
    apoapsis,
    type Elements,
    periapsis,
    trueAnomalyAt,
} from "@cpluspatch/orbit";
import type { Readouts } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import {
    type Drawn,
    draftPlate,
    HEIGHT,
    livePlate,
    type PlateData,
    plateView,
    WIDTH,
} from "./plate.ts";

const earth: PlateData = {
    a: AU,
    e: 0.0167,
    raan: 0,
    argp: 0,
    trueAnomaly: 1,
    parentRadius: 6.957e8,
    periapsisAltitude: 1.47e11,
    apoapsisAltitude: 1.52e11,
    timeToPeriapsis: 86400 * 40,
    timeToApoapsis: 86400 * 220,
    bodyColor: "#00f",
    parentColor: "#fa0",
    unit: null,
};

Deno.test("plateView keeps the badges inside the drawing", () => {
    for (const argp of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const view = plateView({ ...earth, e: 0.7, argp });

        for (const { badge } of [view.periapsis, view.apoapsis]) {
            assert(badge.x >= 21 && badge.x <= WIDTH - 21);
            assert(badge.y >= 10 && badge.y <= HEIGHT - 10);
        }
    }
});

Deno.test("plateView pulls a badge back when its apsis is near the top or bottom", () => {
    const view = plateView({ ...earth, e: 0.7, argp: Math.PI / 2 });
    const ys = [view.periapsis.badge.y, view.apoapsis.badge.y];

    assert(ys.includes(10) || ys.includes(HEIGHT - 10));
});

Deno.test("plateView lists the times and keeps the plate moving", () => {
    const view = plateView(earth);

    assertEquals(view.still, false);
    assert(view.legend.periapsis.time?.startsWith("in "));
    assert(view.legend.apoapsis.time?.startsWith("in "));
});

Deno.test("plateView omits the times of an orbit with none, and marks the plate still", () => {
    const view = plateView({
        ...earth,
        timeToPeriapsis: undefined,
        timeToApoapsis: undefined,
    });

    assertEquals(view.still, true);
    assertEquals(view.legend.periapsis.time, null);
    assertEquals(view.legend.apoapsis.time, null);
    assert(view.legend.periapsis.altitude.length > 0);
});

Deno.test("plateView names the unit and the one it switches to", () => {
    const view = plateView({ ...earth, unit: "km" });

    assertEquals(view.unit, "km");
    assertEquals(view.unitLabel, "Distance unit: km. Switch to AU");
});

const drawn: Drawn = {
    parentRadius: 6.957e8,
    bodyColor: "#00f",
    parentColor: "#fa0",
    unit: "km",
};

const elements: Elements = {
    a: AU,
    e: 0.0167,
    i: 0,
    raan: 0.5,
    argp: 1.5,
    m0: 0.25,
    epoch: 0,
};

Deno.test("draftPlate takes the altitudes from the apsides above the parent's radius, without times", () => {
    const mu = 1.327e20;
    const plate = draftPlate(elements, mu, 1000, drawn);

    assertEquals(
        plate.periapsisAltitude,
        periapsis(elements) - drawn.parentRadius,
    );
    assertEquals(
        plate.apoapsisAltitude,
        apoapsis(elements) - drawn.parentRadius,
    );
    assertEquals(plate.trueAnomaly, trueAnomalyAt(elements, mu, 1000));
    assertEquals(plate.raan, elements.raan);
    assertEquals(plate.argp, elements.argp);
    assertEquals(plate.timeToPeriapsis, undefined);
    assertEquals(plate.timeToApoapsis, undefined);
    assertEquals(plate.unit, "km");
});

Deno.test("livePlate copies the readouts and the given elements", () => {
    const current: Readouts = {
        distance: 1.5e11,
        speed: 3e4,
        period: 3.15e7,
        periapsisAltitude: 1.47e11,
        apoapsisAltitude: 1.52e11,
        trueAnomaly: 2,
        timeToPeriapsis: 1000,
        timeToApoapsis: 2000,
    };
    const plate = livePlate({ a: 2, e: 0.1, raan: 3, argp: 4 }, current, drawn);

    assertEquals(plate, {
        a: 2,
        e: 0.1,
        raan: 3,
        argp: 4,
        trueAnomaly: 2,
        periapsisAltitude: 1.47e11,
        apoapsisAltitude: 1.52e11,
        timeToPeriapsis: 1000,
        timeToApoapsis: 2000,
        ...drawn,
    });
});
