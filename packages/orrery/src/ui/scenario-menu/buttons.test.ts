/// <reference types="deno" />
import { assert } from "@std/assert";
import { classes } from "./buttons.ts";

Deno.test("classes adds the small button class and the extra class", () => {
    const plain = classes("outline").split(" ");
    const extra = classes("ghost", "extra").split(" ");

    assert(plain.includes("orrery__small-button"));
    assert(extra.includes("orrery__small-button"));
    assert(extra.includes("extra"));
    assert(!plain.includes("extra"));
});
