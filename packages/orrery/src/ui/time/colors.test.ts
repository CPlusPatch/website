/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { readColors } from "./colors.ts";

Deno.test("each colour and font is read from its custom property, trimmed", () => {
    const style = {
        getPropertyValue: (name: string) => ` value of ${name} `,
    };

    const colors = readColors(style);

    assertEquals(colors.rule, "value of --orrery-rule");
    assertEquals(colors.ground, "value of --orrery-ground");
    assertEquals(colors.fontUi, "value of --orrery-font-ui");
    assertEquals(colors.fontData, "value of --orrery-font-data");
    assertEquals(Object.keys(colors).length, 11);
});
