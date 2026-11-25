/// <reference types="deno" />
import { AU } from "@cpluspatch/orbit";
import { assertEquals } from "@std/assert";
import {
    aUnit,
    createUnits,
    fromMetres,
    otherUnit,
    toMetres,
} from "./units.ts";

Deno.test("units start automatic and keep what is set", () => {
    const units = createUnits();
    assertEquals(units.get(), null);

    units.set("AU");
    assertEquals(units.get(), "AU");

    units.set(null);
    assertEquals(units.get(), null);
});

Deno.test("toggle flips the shown unit while automatic, then the chosen one", () => {
    const units = createUnits();

    units.toggle("AU");
    assertEquals(units.get(), "km");

    // The shown unit is ignored once one is chosen.
    units.toggle("AU");
    assertEquals(units.get(), "AU");

    units.toggle("AU");
    assertEquals(units.get(), "km");
});

Deno.test("listeners hear a change once and stop after they unsubscribe", () => {
    const units = createUnits();
    let calls = 0;
    const off = units.subscribe(() => calls++);

    units.set("km");
    units.set("km");
    assertEquals(calls, 1);

    off();
    units.set("AU");
    assertEquals(calls, 1);
});

Deno.test("otherUnit swaps km and AU", () => {
    assertEquals(otherUnit("km"), "AU");
    assertEquals(otherUnit("AU"), "km");
});

Deno.test("a is shown in km under 0.1 AU and in AU from there", () => {
    assertEquals(aUnit(0.099 * AU), "km");
    assertEquals(aUnit(0.1 * AU), "AU");
    assertEquals(fromMetres(7e6, "km"), 7000);
    assertEquals(fromMetres(2 * AU, "AU"), 2);
    assertEquals(toMetres(7000, "km"), 7e6);
    assertEquals(toMetres(2, "AU"), 2 * AU);
});
