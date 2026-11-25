/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { Clock, DEFAULT_RATE, RATES, stepRate } from "./clock.ts";

Deno.test("a running clock advances by the rate times the real time", () => {
    const clock = new Clock(100, 60, false);

    clock.tick(2);

    assertEquals(clock.t, 220);
});

Deno.test("a paused clock doesn't advance", () => {
    const clock = new Clock(100, 60, true);

    clock.tick(2);

    assertEquals(clock.t, 100);
});

Deno.test("a negative rate runs the clock backwards", () => {
    const clock = new Clock(100, -10, false);

    clock.tick(3);

    assertEquals(clock.t, 70);
});

Deno.test("set moves the clock to a time", () => {
    const clock = new Clock(0, 1, false);

    clock.set(500);

    assertEquals(clock.t, 500);
});

Deno.test("the default rate is a preset", () => {
    assertEquals(RATES.includes(DEFAULT_RATE), true);
});

Deno.test("stepRate goes to the next and previous preset", () => {
    assertEquals(stepRate(86400, 1), 604800);
    assertEquals(stepRate(86400, -1), 3600);
});

Deno.test("stepRate stops at both ends", () => {
    assertEquals(stepRate(1, -1), 1);
    assertEquals(stepRate(31557600, 1), 31557600);
});

Deno.test("stepRate keeps the sign of a negative rate", () => {
    assertEquals(stepRate(-86400, 1), -604800);
    assertEquals(stepRate(-86400, -1), -3600);
    assertEquals(stepRate(-1, -1), -1);
    assertEquals(stepRate(-31557600, 1), -31557600);
});

Deno.test("stepRate from a rate that isn't a preset goes to the nearest one in that direction", () => {
    assertEquals(stepRate(100, 1), 3600);
    assertEquals(stepRate(100, -1), 60);
    assertEquals(stepRate(-100, 1), -3600);
});
