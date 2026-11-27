/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { documentFile, documentOf } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { MAX_INFLATED_BYTES } from "../../persistence.ts";
import { readScenarioFile } from "./files.ts";

Deno.test("readScenarioFile reads a scenario file", async () => {
    const doc = documentOf(solarSystem);
    const file = new File([JSON.stringify(documentFile(doc))], "a.json");

    const result = await readScenarioFile(file);

    assert(result.ok);
    assertEquals(result.doc.scenario.name, solarSystem.name);
});

Deno.test("readScenarioFile lists the errors of invalid JSON", async () => {
    const result = await readScenarioFile(new File(["{nope"], "a.json"));

    assert(!result.ok);
    assert(typeof result.status === "object" && result.status !== null);
    assert(result.status.invalid.length > 0);
});

Deno.test("readScenarioFile refuses a file that's too big", async () => {
    const big = new File([new Uint8Array(MAX_INFLATED_BYTES + 1)], "a.json");

    const result = await readScenarioFile(big);

    assertEquals(result, {
        ok: false,
        status: "The file is too big to be a scenario.",
    });
});

Deno.test("readScenarioFile says when the file can't be read", async () => {
    const file = new File(["{}"], "a.json");
    file.text = () => Promise.reject(new Error("gone"));

    const result = await readScenarioFile(file);

    assertEquals(result, {
        ok: false,
        status: "The file couldn't be read.",
    });
});
