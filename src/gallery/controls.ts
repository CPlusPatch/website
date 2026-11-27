/**
 * The controls of a story, as plain data: what the bench lets a reader set,
 * and the query string that carries the values to the play page.
 *
 * Pure and browser-safe: the play page and the bench both import it, so it
 * only imports types from story.ts.
 */

import { isIconName } from "../../packages/ui/src/icons.ts";
import type { Story } from "./story.ts";

/**
 * How a prop is controlled: a list of strings to choose from, or one of the
 * other kinds by name. `slot` and `icon` stand for the story's own content.
 */
export type ControlDecl = readonly string[] | "boolean" | "text" | "icon";

export type Control =
    | { key: string; kind: "choice"; values: string[]; value: string }
    | { key: string; kind: "boolean"; value: boolean }
    | { key: string; kind: "text" | "icon"; value: string };

/** A control's value for each key. */
export type ControlValues = Record<string, string | boolean>;

/** Longest text a query may set. */
export const MAX_TEXT = 200;

const ICON_PREFIX = "lucide:";

/** Whether `name` is empty (no icon) or a built-in icon, as `lucide:<name>`. */
const isIcon = (name: string) =>
    name === "" ||
    (name.startsWith(ICON_PREFIX) &&
        isIconName(name.slice(ICON_PREFIX.length)));

type Controlled = Pick<Story, "name" | "props" | "icon" | "slot" | "controls">;

/**
 * A story's controls as a list in declared order, each with its default.
 * Throws for one the story doesn't fit.
 */
export const normaliseControls = (story: Controlled): Control[] => {
    const entries = Object.entries(story.controls ?? {});

    // The live page draws the icon with the Svelte icon, which has fewer than Astro's.
    if (entries.length > 0 && !isIcon(story.icon ?? ""))
        throw new Error(`"${story.name}": ${story.icon} isn't a built-in icon`);

    return entries.map(([key, decl]): Control => {
        const fail = (message: string) =>
            new Error(`"${story.name}" controls "${key}": ${message}`);
        const prop = story.props[key];

        if (key === "icon") {
            if (decl !== "icon") throw fail(`"icon" only takes "icon"`);
            const value = story.icon ?? "";
            if (!isIcon(value)) throw fail(`${value} isn't a built-in icon`);

            return { key, kind: "icon", value };
        }
        if (decl === "icon") throw fail(`only "icon" takes "icon"`);

        if (key === "slot") {
            if (decl !== "text") throw fail(`"slot" only takes "text"`);
            if (typeof story.slot !== "string")
                throw fail("the story has no slot");
            if (story.slot?.includes("<"))
                throw fail("the slot must be plain text");

            return { key, kind: "text", value: story.slot ?? "" };
        }

        if (decl === "boolean") {
            if (typeof prop !== "boolean")
                throw fail("its props don't set a boolean");

            return { key, kind: "boolean", value: prop === true };
        }
        if (decl === "text") {
            if (typeof prop !== "string")
                throw fail("its props don't set a string");

            return { key, kind: "text", value: String(prop) };
        }
        if (typeof decl === "string") throw fail(`unknown kind "${decl}"`);

        if (typeof prop !== "string" || !decl.includes(prop)) {
            throw fail(
                `${JSON.stringify(prop)} isn't one of its values: ${decl.join(", ")}`,
            );
        }

        return { key, kind: "choice", values: [...decl], value: String(prop) };
    });
};

const parseOne = (control: Control, raw: string | null): string | boolean => {
    if (raw === null) return control.value;

    switch (control.kind) {
        case "choice":
            return control.values.includes(raw) ? raw : control.value;
        case "boolean":
            return raw === "true"
                ? true
                : raw === "false"
                  ? false
                  : control.value;
        case "icon":
            return isIcon(raw) ? raw : control.value;
        case "text":
            return raw.slice(0, MAX_TEXT);
    }
};

/**
 * The value of every control, read from a query string. A key that's
 * missing or has a bad value gets the control's default.
 */
export const parseControls = (
    controls: Control[],
    search: string,
): ControlValues => {
    const params = new URLSearchParams(search);

    return Object.fromEntries(
        controls.map((control) => [
            control.key,
            parseOne(control, params.get(control.key)),
        ]),
    );
};

/**
 * A query string (no leading `?`) with the values that differ from their
 * defaults, in control order. Empty when all are defaults.
 */
export const controlQuery = (
    controls: Control[],
    values: ControlValues,
): string => {
    const params = new URLSearchParams();
    for (const control of controls) {
        const value = values[control.key];
        if (value !== undefined && value !== control.value) {
            params.set(control.key, String(value));
        }
    }

    return params.toString();
};
