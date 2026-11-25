/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { spoken } from "./readouts.ts";

Deno.test("spoken reads the apsides, the speed and the period", () => {
    const text = spoken(
        {
            distance: 1.5e11,
            speed: 29780,
            period: 31558149,
            periapsisAltitude: 1.47e11,
            apoapsisAltitude: 1.52e11,
            trueAnomaly: 1,
            timeToPeriapsis: 86400 * 40,
            timeToApoapsis: 86400 * 220,
        },
        "AU",
    );

    assertEquals(text.startsWith("Apoapsis "), true);
    assertEquals(text.includes(" up, in "), true);
    assertEquals(text.includes("Periapsis "), true);
    assertEquals(text.includes("Speed "), true);
    assertEquals(text.endsWith("."), true);
});
