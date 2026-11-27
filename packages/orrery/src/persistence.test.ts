/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import {
    type Document,
    documentFile,
    documentOf,
    type TimelineEvent,
    validateScenario,
} from "@cpluspatch/sim";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import edited from "../../catalog/src/fixtures/edited-v2.json" with {
    type: "json",
};
import {
    decodeDocument,
    encodeDocument,
    hashPayload,
    MAX_PAYLOAD_CHARS,
    nameProblem,
    openScenario,
    parseDocumentJson,
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

const burn: TimelineEvent = {
    type: "burn",
    id: "e1",
    bodyId: "moon",
    t: 1000,
    dv: { prograde: 100, normal: 0, radial: 0 },
};

const doc = documentOf(scenario);
const burned: Document = { ...doc, timeline: [burn] };

const badColour = {
    ...scenario,
    bodies: scenario.bodies.map((body, i) =>
        i === 0 ? { ...body, appearance: { color: "red" } } : body,
    ),
};

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

    const text = await encodeDocument(doc);
    const result = await decodeDocument(text);

    assert(expected.ok);
    assertEquals(result, { ok: true, doc: documentOf(expected.scenario) });
    assertEquals(result.ok && result.doc.scenario.time, 123456);
});

Deno.test("a share link keeps a burn", async () => {
    const result = await decodeDocument(await encodeDocument(burned));

    assert(result.ok);
    assertEquals(result.doc.timeline, [burn]);
});

// Captured from `encodeDocument` on the edited-v2 fixture, so old links keep opening.
const EDITED_V2_LINK =
    "hZRNb9swDIb_SqBdU0ES9Zn7jr10x2EH1VFWo45tyM6wLMh_H21LsbIFrS82KZHi84r0hfwKcai7luzElrT-GMiOPJ83dduGuBnOwxiOZEvGelqwLD1b8trt6zCQ3fcLqfcYMpxacov_NhvvdTuvjD6idTyRHQdhuJCSMX5Lhbmi39cnzKWdMslVdU0XMfjL4bAXxmN872NoR7JrT02zJaEJRzSHxb5uUxXBx_FtreNrMlMlfePbMKZawFnNmJSpkqIKMJwxSyXu6_ahKdLmGhLtWsSFeKSTTjnLBMzp8HxGGddmS2r8nPL7dv7w8WePu6lxWuMZDI-kQjKOMX1XveGe6w3o2HWFrs-LlXDS2gQjHRP2f0G5ASMnRwZJITeODPYPCVgJzhUYSroFgzLrbGYRlFshM5CiSgmzAAkKSosCCM-MoQrD0mkX0ndNmN6_Z0XOU2ZwBh-ulHUwqYja_Jn8jhtpBdOCWWwPhalapHnxIyZ44pQZzsOTXapYvALlNBqdq47YhGN9J-V5s_pyp_a-ClX0h9wjhZSqbEr3GuBwwE1xxiiyf6asNo4Vuk6XPsuKXp1l5VRkTRlVi6BAH7ZH7Kr3lellsRKNx9GNHW5Ls_dg4Li4H7aKWab8p40OwIpkMwm3CYSbFYNnDEHdgsGmqXrQ5T4OxdUs1qOhlcKKR38OAOvUXaMvOT7mEMI4cKB1cSMOZO50EHCbWmq1grXTMUBmIgDjSqgf178";

Deno.test("a share link from the version 2 encoder decodes to the same scenario", async () => {
    const expected = validateScenario(edited);

    const result = await decodeDocument(EDITED_V2_LINK);

    assert(expected.ok);
    assertEquals(result, { ok: true, doc: documentOf(expected.scenario) });
});

Deno.test("an encoded scenario is URL-safe and smaller than its JSON", async () => {
    const text = await encodeDocument(doc);

    assert(/^[A-Za-z0-9_-]+$/.test(text));
    assert(text.length < JSON.stringify(scenario).length);
});

Deno.test("text that isn't base64 doesn't decode", async () => {
    const result = await decodeDocument("not base64!");

    assertEquals(result.ok, false);
});

Deno.test("a truncated payload doesn't decode", async () => {
    const text = await encodeDocument(doc);

    const result = await decodeDocument(text.slice(0, text.length / 2));

    assertEquals(result.ok, false);
});

Deno.test("base64 of something that isn't deflate doesn't decode", async () => {
    const result = await decodeDocument(btoa("hello world, not deflate"));

    assertEquals(result.ok, false);
});

Deno.test("a payload that inflates past the limit doesn't decode", async () => {
    const stream = new Blob([" ".repeat(2 * 1024 * 1024)])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());

    const result = await decodeDocument(toBase64Url(bytes));

    assert(!result.ok);
    assertStringIncludes(result.errors[0] ?? "", "too large");
});

Deno.test("a payload longer than the limit isn't decoded", async () => {
    const result = await decodeDocument("A".repeat(MAX_PAYLOAD_CHARS + 1));

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

    const result = await decodeDocument(text);

    assertEquals(result.ok, false);
});

Deno.test("a payload of JSON that isn't a scenario lists the errors", async () => {
    const text = await encodeDocument(
        documentOf({ version: 2, bodies: [] } as never),
    );

    const result = await decodeDocument(text);

    assert(!result.ok);
    assert(result.errors.length > 0);
});

Deno.test("scenario JSON that fails to parse or validate is an error", () => {
    assertEquals(parseDocumentJson("{").ok, false);
    assertEquals(parseDocumentJson("{}").ok, false);
    assertEquals(parseDocumentJson(JSON.stringify(scenario)).ok, true);
});

Deno.test("scenario JSON with a bad body colour is an error", () => {
    const result = parseDocumentJson(JSON.stringify(badColour));

    assert(!result.ok);
    assertStringIncludes(
        result.errors.join("\n"),
        `${scenario.bodies[0]?.id}.appearance.color:`,
    );
});

Deno.test("a saved scenario is read back, and nothing saved is null", () => {
    const storage = memory();
    assertEquals(readSaved(storage), null);

    writeSaved(storage, doc);

    assert(storage.data.has(STORAGE_KEY));
    assertEquals(readSaved(storage), { ok: true, doc });
});

Deno.test("a saved copy keeps a burn, and leaves the key out when there is none", () => {
    const storage = memory();

    writeSaved(storage, burned);
    assertEquals(readSaved(storage), { ok: true, doc: burned });

    writeSaved(storage, doc);
    assertEquals(storage.data.get(STORAGE_KEY)?.includes("timeline"), false);
});

Deno.test("a saved copy that is damaged reads as an error", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "{broken");

    assertEquals(readSaved(storage)?.ok, false);
});

Deno.test("a storage that throws reads as nothing saved and ignores writes", () => {
    assertEquals(readSaved(throwing), null);

    writeSaved(throwing, doc);
});

Deno.test("only a hash with a payload is a share link", () => {
    assertEquals(hashPayload("#s=abc"), "abc");
    assertEquals(hashPayload("#s="), null);
    assertEquals(hashPayload("#other"), null);
    assertEquals(hashPayload(""), null);
});

Deno.test("a valid share link opens first, with no notice", async () => {
    const storage = memory();
    writeSaved(storage, documentOf(solarSystem));
    const link = await encodeDocument(
        documentOf({ ...scenario, name: "Linked" }),
    );

    const opened = await openScenario(`#s=${link}`, storage);

    assertEquals(opened.source, "link");
    assertEquals(opened.doc.scenario.name, "Linked");
    assertEquals(opened.notice, null);
});

Deno.test("a bad share link falls back to the saved copy and says so", async () => {
    const storage = memory();
    writeSaved(storage, documentOf({ ...scenario, name: "Mine" }));

    const opened = await openScenario("#s=garbage!", storage);

    assertEquals(opened.source, "saved");
    assertEquals(opened.doc.scenario.name, "Mine");
    assertEquals(
        opened.notice,
        "The shared link isn't a valid scenario, so your saved one opened.",
    );
});

Deno.test("with no link and nothing saved, the solar system opens quietly", async () => {
    const opened = await openScenario("", memory());

    assertEquals(opened.source, "default");
    assertEquals(opened.doc, documentOf(solarSystem));
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
    doc: documentOf({ ...scenario, name }),
});

// The entry as `writeList` puts it on disk.
const onDisk = ({ savedAt, doc }: { savedAt: number; doc: Document }) => ({
    savedAt,
    scenario: documentFile(doc),
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
            onDisk(entry("Good")),
            { savedAt: 2, scenario: { version: 2, bodies: [] } },
            { savedAt: "later", scenario },
            null,
            "text",
        ]),
    );

    const list = readList(storage);

    assertEquals(
        list.map((saved) => saved.doc.scenario.name),
        ["Good"],
    );
});

Deno.test("a saved entry with a bad body colour is dropped from the list", () => {
    const storage = memory();
    storage.setItem(
        SAVED_LIST_KEY,
        JSON.stringify([
            onDisk(entry("Good")),
            { savedAt: 2, scenario: badColour },
        ]),
    );

    const list = readList(storage);

    assertEquals(
        list.map((saved) => saved.doc.scenario.name),
        ["Good"],
    );
});

Deno.test("writing a list reports a storage that refuses it", () => {
    assertEquals(writeList(throwing, [entry("One")]), false);
});

Deno.test("the saved list and the autosave use different keys", () => {
    const storage = memory();

    writeSaved(storage, doc);
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

Deno.test("a saved list keeps a burn and drops an entry whose timeline is invalid", () => {
    const storage = memory();
    const good = { savedAt: 1, doc: burned };
    const bad = { ...burn, bodyId: "nowhere" };
    storage.setItem(
        SAVED_LIST_KEY,
        JSON.stringify([
            onDisk(good),
            { savedAt: 2, scenario: { ...scenario, timeline: [bad] } },
        ]),
    );

    assertEquals(readList(storage), [good]);
    assertEquals(writeList(storage, [good]), true);
    assertEquals(readList(storage), [good]);
});
