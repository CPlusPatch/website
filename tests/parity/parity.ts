// Not named *.test.ts, so `deno test` skips it: it needs more permissions (see test:parity).
import { getViteConfig } from "astro/config";
import { ELEMENT_NODE, type Node, parse, TEXT_NODE } from "ultrahtml";
import { createServer } from "vite";
// Types only: render.ts imports .astro files, which only Vite can load.
import type { RenderedCase } from "./types.ts";

type Tree = {
    name: string;
    attributes: Record<string, string>;
    children: (Tree | string)[];
};

// Scoping hashes, which only one side emits.
const ASTRO_HASH = /^data-astro-cid-[a-z0-9]+$/;
const SVELTE_HASH = /^svelte-[a-z0-9]+$/;

const isBlank = (child: Tree | string | undefined): boolean => child === " ";

const normalise = (nodes: Node[]): (Tree | string)[] => {
    const out: (Tree | string)[] = [];

    for (const node of nodes) {
        if (node.type === TEXT_NODE) {
            const text = node.value.replace(/\s+/g, " ");
            if (text !== "") out.push(text);
            continue;
        }

        if (node.type !== ELEMENT_NODE) continue;

        const attributes: Record<string, string> = {};

        for (const [key, value] of Object.entries(node.attributes)) {
            if (ASTRO_HASH.test(key)) continue;

            attributes[key] =
                key === "class"
                    ? value
                          .split(/\s+/)
                          .filter(
                              (name) => name !== "" && !SVELTE_HASH.test(name),
                          )
                          .join(" ")
                    : value;
        }

        out.push({
            name: node.name,
            attributes,
            children: normalise(node.children),
        });
    }

    // Whitespace at the start or end of a child list isn't rendered.
    while (out.length > 0 && isBlank(out[0])) out.shift();
    while (out.length > 0 && isBlank(out[out.length - 1])) out.pop();

    return out;
};

// Whitespace beside a Svelte {#if} or {#each}, found by its hydration markers. It's
// formatting, as whitespace beside a {…} in Astro is, which Astro drops.
const SVELTE_BLOCK_EDGE = /\s+(?=<!--\[)|(?<=<!--\]-->)\s+/g;

// Stripped before parsing: ultrahtml drops the text that sits right before a comment.
const stripComments = (html: string): string =>
    html.replace(SVELTE_BLOCK_EDGE, "").replace(/<!--[\s\S]*?-->/g, "");

const tree = (html: string): (Tree | string)[] =>
    normalise(parse(stripComments(html)).children);

Deno.test("Svelte ports render the same HTML as the Astro components", async (t) => {
    const server = await createServer(
        await getViteConfig({
            server: { middlewareMode: true },
            appType: "custom",
            logLevel: "error",
        })({ command: "serve", mode: "test" }),
    );

    try {
        const render = (await server.ssrLoadModule(
            new URL("./render.ts", import.meta.url).pathname,
        )) as {
            renderCases: () => Promise<RenderedCase[]>;
            renderSvelteIcon: (name: string) => string;
        };
        const cases = await render.renderCases();

        if (cases.length === 0) throw new Error("No story has a Svelte port");

        for (const { name, astro, svelte, skip } of cases) {
            await t.step({
                name,
                ignore: skip !== undefined,
                fn: () => compare(astro, svelte),
            });
        }

        await t.step("the Svelte icon throws on an unknown icon", () => {
            for (const name of ["lucide:no-such-icon", "mdi:home"]) {
                let message = "";

                try {
                    render.renderSvelteIcon(name);
                } catch (error) {
                    message = String(error);
                }

                if (!message.includes(name) || !message.includes("built-in")) {
                    throw new Error(
                        `Expected a built-in icon error for ${name}, got "${message}"`,
                    );
                }
            }
        });

        for (const { name, skip } of cases) {
            if (skip) console.log(`skipped ${name}: ${skip}`);
        }
    } finally {
        await server.close();
    }
});

const compare = (astro: string, svelte: string): void => {
    // A JSON string compares by value and prints the difference.
    const expected = JSON.stringify(tree(astro), null, 2);
    const actual = JSON.stringify(tree(svelte), null, 2);

    if (expected !== actual) {
        throw new Error(
            `Astro:  ${astro}\nSvelte: ${svelte}\n\nAstro tree:\n${expected}\n\nSvelte tree:\n${actual}`,
        );
    }
};
