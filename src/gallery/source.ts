/*
 * A story as readable markup, for its Props panel: `<Button variant="solid">
 * Primary</Button>`. Not runnable source, just what the story passes: big
 * values are cut short and anything that isn't data (a component, a
 * function) is named rather than printed.
 */

import type { Story } from "./story.ts";

const MAX_STRING = 80;
const MAX_ITEMS = 4;
const MAX_DEPTH = 2;

/**
 * Astro names a compiled component after its file (`$$button-group`, or
 * without the $$); spell it as it is imported, ButtonGroup.
 */
const componentName = (fn: { name: string }) =>
    fn.name
        .replace(/^\$\$/, "")
        .replace(/(?:^|[-_])(\w)/g, (_, c: string) => c.toUpperCase()) ||
    "Component";

const short = (s: string) =>
    s.length > MAX_STRING ? `${s.slice(0, MAX_STRING - 1)}…` : s;

/** A JS value, cut to a few items and levels, on one line. */
const value = (v: unknown, depth = 0, seen = new Set<object>()): string => {
    if (v === null || v === undefined) return String(v);
    if (typeof v === "string") return JSON.stringify(short(v));
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return componentName(v);
    if (typeof v !== "object") return String(v);
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (v instanceof URL) return JSON.stringify(short(v.href));
    if (seen.has(v)) return "…";
    seen.add(v);

    if (Array.isArray(v)) {
        if (depth >= MAX_DEPTH) return `[…${v.length}]`;
        const items = v
            .slice(0, MAX_ITEMS)
            .map((x) => value(x, depth + 1, seen));
        if (v.length > MAX_ITEMS) items.push(`…${v.length - MAX_ITEMS} more`);
        return `[${items.join(", ")}]`;
    }
    // An imported image (astro:assets): its file is what matters.
    if ("src" in v && "width" in v && "format" in v) {
        return `image(${JSON.stringify(short(String(v.src)))})`;
    }
    const entries = Object.entries(v);
    if (depth >= MAX_DEPTH) return entries.length ? "{…}" : "{}";
    const shown = entries
        .slice(0, MAX_ITEMS)
        .map(([k, x]) => `${k}: ${value(x, depth + 1, seen)}`);
    if (entries.length > MAX_ITEMS) shown.push("…");
    return `{ ${shown.join(", ")} }`;
};

const attribute = ([name, v]: [string, unknown]) => {
    if (v === true) return name;
    if (typeof v === "string") return `${name}=${JSON.stringify(short(v))}`;
    return `${name}={${value(v)}}`;
};

const indent = (s: string) =>
    s
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");

/** The story, and any it nests, as markup. */
export const storySource = (story: Story): string => {
    const name = componentName(story.component);
    const attributes = Object.entries(story.props)
        .filter(([, v]) => v !== undefined)
        .map(attribute);
    const open = [name, ...attributes].join(" ");

    const body = [
        story.icon && `<Icon name="${story.icon}" />`,
        story.slot && short(story.slot.trim()),
        ...(story.children ?? []).map(storySource),
        ...Object.entries(story.slots ?? {}).flatMap(([slot, children]) =>
            children.map((child) =>
                storySource(child).replace(
                    /^<([\w.$-]+)/,
                    `<$1 slot="${slot}"`,
                ),
            ),
        ),
    ].filter(Boolean) as string[];

    if (!body.length) return `<${open} />`;
    if (body.length === 1 && !body[0].includes("\n") && body[0].length < 40) {
        return `<${open}>${body[0]}</${name}>`;
    }
    return `<${open}>\n${indent(body.join("\n"))}\n</${name}>`;
};
