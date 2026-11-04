/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { ICONS, iconSvg, isIconName } from "./icons.ts";

Deno.test("iconSvg draws a sized, hidden, hookable svg", () => {
    assertEquals(
        iconSvg("x", { class: "dropdown__chevron" }),
        `<svg width="1em" height="1em" viewBox="0 0 24 24" class="dropdown__chevron" aria-hidden="true" data-icon="lucide:x">${ICONS.x}</svg>`,
    );
    assertEquals(
        iconSvg("x", { ariaHidden: false }).includes("aria-hidden"),
        false,
    );
});

Deno.test("isIconName only accepts the built-in icons", () => {
    assert(isIconName("chevron-down"));
    assert(!isIconName("at-sign"));
    assert(!isIconName("toString"));
});

// The Astro adapter falls back to astro-icon for a name that isn't built in,
// which would hide a missing one. Pin every literal icon the components use.
Deno.test("every lucide icon the Astro components name is built in", async () => {
    const used = new Set<string>();
    const walk = async (dir: URL) => {
        for await (const entry of Deno.readDir(dir)) {
            const url = new URL(entry.name, dir);
            if (entry.isDirectory) await walk(new URL(`${entry.name}/`, dir));
            else if (entry.name.endsWith(".astro")) {
                const source = await Deno.readTextFile(url);
                for (const m of source.matchAll(/"lucide:([a-z0-9-]+)"/g))
                    used.add(m[1]);
            }
        }
    };
    await walk(new URL("./astro/", import.meta.url));
    assert(used.size > 0);
    for (const name of used)
        assert(isIconName(name), `${name} is not built in`);
});
