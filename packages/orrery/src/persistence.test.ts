/// <reference types="deno" />
import { solarSystem, validateScenario } from "@cpluspatch/orbit";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
    decodeScenario,
    encodeScenario,
    hashPayload,
    MAX_PAYLOAD_CHARS,
    nameProblem,
    openScenario,
    parseScenarioJson,
    readList,
    readSaved,
    SAVED_LIST_KEY,
    STORAGE_KEY,
    startTime,
    toBase64Url,
    writeList,
    writeSaved,
} from "./persistence.ts";

const scenario = { ...solarSystem, time: 123456 };

const memory = (): Pick<Storage, "getItem" | "setItem"> & {
    data: Map<string, string>;
} => {
    const data = new Map<string, string>();

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
    };
};

const throwing = {
    getItem: (): string | null => {
        throw new Error("blocked");
    },
    setItem: (): void => {
        throw new Error("full");
    },
};

Deno.test("a scenario survives encoding and decoding", async () => {
    const expected = validateScenario(scenario);

    const text = await encodeScenario(scenario);
    const result = await decodeScenario(text);

    assert(expected.ok);
    assertEquals(result, expected);
    assertEquals(result.ok && result.scenario.time, 123456);
});

Deno.test("an encoded scenario is URL-safe and smaller than its JSON", async () => {
    const text = await encodeScenario(scenario);

    assert(/^[A-Za-z0-9_-]+$/.test(text));
    assert(text.length < JSON.stringify(scenario).length);
});

Deno.test("text that isn't base64 doesn't decode", async () => {
    const result = await decodeScenario("not base64!");

    assertEquals(result.ok, false);
});

Deno.test("a truncated payload doesn't decode", async () => {
    const text = await encodeScenario(scenario);

    const result = await decodeScenario(text.slice(0, text.length / 2));

    assertEquals(result.ok, false);
});

Deno.test("base64 of something that isn't deflate doesn't decode", async () => {
    const result = await decodeScenario(btoa("hello world, not deflate"));

    assertEquals(result.ok, false);
});

Deno.test("a payload that inflates past the limit doesn't decode", async () => {
    const stream = new Blob([" ".repeat(2 * 1024 * 1024)])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());

    const result = await decodeScenario(toBase64Url(bytes));

    assert(!result.ok);
    assertStringIncludes(result.errors[0] ?? "", "too large");
});

Deno.test("a payload longer than the limit isn't decoded", async () => {
    const result = await decodeScenario("A".repeat(MAX_PAYLOAD_CHARS + 1));

    assert(!result.ok);
    assertStringIncludes(result.errors[0] ?? "", "too long");
});

Deno.test("base64url uses - and _ and drops the padding", () => {
    // 0xfb 0xff 0xfe is "+//+" in base64, and the length leaves padding.
    assertEquals(toBase64Url(new Uint8Array([0xfb, 0xff, 0xfe])), "-__-");
    assertEquals(toBase64Url(new Uint8Array([0xfb, 0xff])), "-_8");
});

Deno.test("a payload of text that isn't JSON doesn't decode", async () => {
    const stream = new Blob(["{nope"])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const text = btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");

    const result = await decodeScenario(text);

    assertEquals(result.ok, false);
});

Deno.test("a payload of JSON that isn't a scenario lists the errors", async () => {
    const text = await encodeScenario({ version: 2, bodies: [] } as never);

    const result = await decodeScenario(text);

    assert(!result.ok);
    assert(result.errors.length > 0);
});

Deno.test("scenario JSON that fails to parse or validate is an error", () => {
    assertEquals(parseScenarioJson("{").ok, false);
    assertEquals(parseScenarioJson("{}").ok, false);
    assertEquals(parseScenarioJson(JSON.stringify(scenario)).ok, true);
});

Deno.test("a saved scenario is read back, and nothing saved is null", () => {
    const storage = memory();
    assertEquals(readSaved(storage), null);

    writeSaved(storage, scenario);

    assert(storage.data.has(STORAGE_KEY));
    assertEquals(readSaved(storage), validateScenario(scenario));
});

Deno.test("a saved copy that is damaged reads as an error", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "{broken");

    assertEquals(readSaved(storage)?.ok, false);
});

Deno.test("a storage that throws reads as nothing saved and ignores writes", () => {
    assertEquals(readSaved(throwing), null);

    writeSaved(throwing, scenario);
});

Deno.test("only a hash with a payload is a share link", () => {
    assertEquals(hashPayload("#s=abc"), "abc");
    assertEquals(hashPayload("#s="), null);
    assertEquals(hashPayload("#other"), null);
    assertEquals(hashPayload(""), null);
});

Deno.test("a valid share link opens first, with no notice", async () => {
    const storage = memory();
    writeSaved(storage, solarSystem);
    const link = await encodeScenario({ ...scenario, name: "Linked" });

    const opened = await openScenario(`#s=${link}`, storage);

    assertEquals(opened.source, "link");
    assertEquals(opened.scenario.name, "Linked");
    assertEquals(opened.notice, null);
});

Deno.test("a bad share link falls back to the saved copy and says so", async () => {
    const storage = memory();
    writeSaved(storage, { ...scenario, name: "Mine" });

    const opened = await openScenario("#s=garbage!", storage);

    assertEquals(opened.source, "saved");
    assertEquals(opened.scenario.name, "Mine");
    assertEquals(
        opened.notice,
        "The shared link isn't a valid scenario, so your saved one opened.",
    );
});

Deno.test("with no link and nothing saved, the solar system opens quietly", async () => {
    const opened = await openScenario("", memory());

    assertEquals(opened.source, "default");
    assertEquals(opened.scenario, solarSystem);
    assertEquals(opened.notice, null);
});

Deno.test("a bad link and a bad saved copy both get named", async () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "{broken");

    const opened = await openScenario("#s=garbage!", storage);

    assertEquals(opened.source, "default");
    assertStringIncludes(opened.notice ?? "", "The shared link and your saved");
    assertStringIncludes(opened.notice ?? "", "the solar system opened");
});

Deno.test("a scenario starts at its own time, else now", () => {
    assertEquals(startTime(scenario, 0), 123456);
    assertEquals(startTime(solarSystem, 946728000000), 0);
});

const entry = (name: string, savedAt = 1) => ({
    savedAt,
    scenario: { ...scenario, name },
});

Deno.test("a saved list reads back as it was written", () => {
    const storage = memory();
    const list = [entry("One", 1), entry("Two", 2)];

    const written = writeList(storage, list);

    assert(written);
    assertEquals(readList(storage), list);
});

Deno.test("an empty storage reads as an empty list", () => {
    assertEquals(readList(memory()), []);
});

Deno.test("a blocked storage reads as an empty list", () => {
    assertEquals(readList(throwing), []);
});

Deno.test("a list that isn't JSON or an array reads as empty", () => {
    const storage = memory();

    storage.setItem(SAVED_LIST_KEY, "{nope");
    assertEquals(readList(storage), []);

    storage.setItem(SAVED_LIST_KEY, JSON.stringify({ not: "a list" }));
    assertEquals(readList(storage), []);
});

Deno.test("entries that aren't valid scenarios are dropped from the list", () => {
    const storage = memory();
    storage.setItem(
        SAVED_LIST_KEY,
        JSON.stringify([
            entry("Good"),
            { savedAt: 2, scenario: { version: 2, bodies: [] } },
            { savedAt: "later", scenario },
            null,
            "text",
        ]),
    );

    const list = readList(storage);

    assertEquals(
        list.map((saved) => saved.scenario.name),
        ["Good"],
    );
});

Deno.test("writing a list reports a storage that refuses it", () => {
    assertEquals(writeList(throwing, [entry("One")]), false);
});

Deno.test("the saved list and the autosave use different keys", () => {
    const storage = memory();

    writeSaved(storage, scenario);
    writeList(storage, [entry("One")]);

    assert(storage.data.has(STORAGE_KEY));
    assert(storage.data.has(SAVED_LIST_KEY));
    assert(readSaved(storage)?.ok);
});

Deno.test("a blank name is a problem", () => {
    assertEquals(nameProblem([], "   "), "Enter a name.");
    assertEquals(nameProblem([], ""), "Enter a name.");
});

Deno.test("a name that's taken is a problem, ignoring case and padding", () => {
    const list = [entry("Earth and Moon")];

    assertEquals(
        nameProblem(list, "  earth AND moon "),
        "A scenario called earth AND moon already exists.",
    );
});

Deno.test("a new name is fine", () => {
    assertEquals(nameProblem([entry("One")], "Two"), null);
});
