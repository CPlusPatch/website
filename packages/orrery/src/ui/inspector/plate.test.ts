/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import { HEIGHT, type PlateData, plateView, WIDTH } from "./plate.ts";

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
