import { solarSystem } from "@cpluspatch/catalog";
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { validateAppearance } from "@cpluspatch/render";
import {
    type Scenario,
    type ScenarioResult,
    validateScenario,
} from "@cpluspatch/sim";

/** The `localStorage` key of the saved scenario. */
export const STORAGE_KEY = "orrery:v1";

/** The `localStorage` key of the named scenarios. */
export const SAVED_LIST_KEY = "orrery:saved:v1";

/** What a share link's hash starts with. */
export const HASH_PREFIX = "#s=";

/** The `Storage` methods the saved copy needs. */
export type SavedStorage = Pick<Storage, "getItem" | "setItem">;

const fail = (message: string): ScenarioResult => ({
    ok: false,
    errors: [message],
});

/** The most a share link's base64url payload may hold, in characters. */
export const MAX_PAYLOAD_CHARS = 256 * 1024;

/** The most a share link's payload may inflate to, in bytes. */
export const MAX_INFLATED_BYTES = 1024 * 1024;

/** Bytes as unpadded base64url. */
export const toBase64Url = (bytes: Uint8Array): string => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);

    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
};

const fromBase64Url = (text: string): Uint8Array => {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));

    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const pipe = async (
    bytes: Uint8Array<ArrayBuffer>,
    stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> =>
    new Uint8Array(
        await new Response(
            new Blob([bytes]).stream().pipeThrough(stream),
        ).arrayBuffer(),
    );

/** The scenario as compressed JSON in base64url, for a share link. */
export const encodeScenario = async (s: Scenario): Promise<string> => {
    const json = new TextEncoder().encode(JSON.stringify(s));

    return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
};

/** Inflates `bytes`, or returns `null` once the output passes the limit. */
const inflate = async (
    bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array | null> => {
    const reader = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        size += value.length;
        if (size > MAX_INFLATED_BYTES) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }

    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }

    return out;
};

/** The scenario in `text` (from `encodeScenario`), or why it isn't one. */
export const decodeScenario = async (text: string): Promise<ScenarioResult> => {
    if (text.length > MAX_PAYLOAD_CHARS) return fail("The link is too long.");

    let json: string;

    try {
        const inflated = await inflate(Uint8Array.from(fromBase64Url(text)));
        if (!inflated) return fail("The data is too large.");

        json = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
    } catch {
        return fail("The data is damaged or cut short.");
    }

    return parseScenarioJson(json);
};

/** The scenario in JSON `text`, or why it isn't one. */
export const parseScenarioJson = (text: string): ScenarioResult => {
    let input: unknown;

    try {
        input = JSON.parse(text);
    } catch {
        return fail("The text isn't valid JSON.");
    }

    return validateScenario(input, { appearance: validateAppearance });
};

/** The saved scenario, or `null` when nothing (readable) is saved. */
export const readSaved = (storage: SavedStorage): ScenarioResult | null => {
    let text: string | null;

    try {
        text = storage.getItem(STORAGE_KEY);
    } catch {
        // Storage can be blocked, which is the same as having nothing saved.
        return null;
    }

    return text === null ? null : parseScenarioJson(text);
};

/** Saves the scenario. Does nothing when the storage refuses it. */
export const writeSaved = (storage: SavedStorage, s: Scenario): void => {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
        // A full or blocked storage only costs the autosave.
    }
};

/** A scenario the user saved under a name. */
export type SavedScenario = {
    /** When it was saved, in Unix ms. */
    savedAt: number;
    scenario: Scenario;
};

/** The named scenarios, in the order they were saved. Bad entries are dropped. */
export const readList = (storage: SavedStorage): SavedScenario[] => {
    let parsed: unknown;

    try {
        const text = storage.getItem(SAVED_LIST_KEY);
        if (text === null) return [];

        parsed = JSON.parse(text);
    } catch {
        // Blocked storage and bad JSON both read as nothing saved.
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    const list: SavedScenario[] = [];
    for (const entry of parsed as unknown[]) {
        if (typeof entry !== "object" || entry === null) continue;

        const { savedAt, scenario } = entry as Record<string, unknown>;
        if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) continue;

        const result = validateScenario(scenario, {
            appearance: validateAppearance,
        });
        if (result.ok) list.push({ savedAt, scenario: result.scenario });
    }

    return list;
};

/** The window event for a change to the named scenarios, so the timeline redraws its flags. */
export const SAVED_CHANGED = "orrery:saved-changed";

/** Saves the named scenarios. Returns `false` when the storage refuses them. */
export const writeList = (
    storage: SavedStorage,
    list: SavedScenario[],
): boolean => {
    try {
        storage.setItem(SAVED_LIST_KEY, JSON.stringify(list));

        return true;
    } catch {
        return false;
    }
};

/** Why `name` can't be saved next to the scenarios in `list`, or `null`. */
export const nameProblem = (
    list: SavedScenario[],
    name: string,
): string | null => {
    const trimmed = name.trim();
    if (trimmed === "") return "Enter a name.";

    const taken = list.some(
        ({ scenario }) =>
            scenario.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    return taken ? `A scenario called ${trimmed} already exists.` : null;
};

/** The payload of a share link's hash, or `null` if it isn't one. */
export const hashPayload = (hash: string): string | null =>
    hash.startsWith(HASH_PREFIX) && hash.length > HASH_PREFIX.length
        ? hash.slice(HASH_PREFIX.length)
        : null;

/** Where the opened scenario came from. */
export type Source = "link" | "saved" | "default";

/** The scenario to open, where it came from, and what to tell the user. */
export type Opened = {
    scenario: Scenario;
    source: Source;
    /** Set when a source that was there turned out to be invalid. */
    notice: string | null;
};

const failure = (failed: string[], opened: string): string => {
    const subject =
        failed.length === 1
            ? `${failed[0]} isn't a valid scenario`
            : `${failed.join(" and ")} aren't valid scenarios`;

    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}, so ${opened} opened.`;
};

/** Opens the share link in `hash`, else the saved copy, else the solar system. */
export const openScenario = async (
    hash: string,
    storage: SavedStorage,
): Promise<Opened> => {
    const failed: string[] = [];

    const payload = hashPayload(hash);
    if (payload !== null) {
        const result = await decodeScenario(payload);
        if (result.ok) {
            return { scenario: result.scenario, source: "link", notice: null };
        }

        failed.push("the shared link");
    }

    const saved = readSaved(storage);
    if (saved?.ok) {
        return {
            scenario: saved.scenario,
            source: "saved",
            notice:
                failed.length > 0 ? failure(failed, "your saved one") : null,
        };
    }
    if (saved) failed.push("your saved copy");

    return {
        scenario: solarSystem,
        source: "default",
        notice: failed.length > 0 ? failure(failed, "the solar system") : null,
    };
};

/** When a scenario starts, in seconds since J2000: its own time, else now. */
export const startTime = (s: Scenario, nowMs: number = Date.now()): number =>
    s.time ?? unixMsToJ2000s(nowMs);
