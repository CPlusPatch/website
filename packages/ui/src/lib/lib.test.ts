/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { cx } from "./classes.ts";
import { STORAGE_KEY } from "./display.ts";
import { formatTime } from "./media.ts";
import { measure } from "./progress.ts";
import { PAINTED, themeInitScript } from "./theme-init.ts";
import { TONES } from "./tone.ts";

Deno.test("cx keeps the truthy values, in order", () => {
    assertEquals(cx("a", false, null, undefined, "", "b"), ["a", "b"]);
});

Deno.test("formatTime switches to hours at an hour", () => {
    assertEquals(formatTime(0), "0:00");
    assertEquals(formatTime(59.9), "0:59");
    assertEquals(formatTime(65), "1:05");
    assertEquals(formatTime(3599), "59:59");
    assertEquals(formatTime(3600), "1:00:00");
    assertEquals(formatTime(3725), "1:02:05");
});

Deno.test("measure clamps to the range and guards a zero max", () => {
    assertEquals(measure(50, 100), { now: 50, fraction: 0.5 });
    assertEquals(measure(-5, 100), { now: 0, fraction: 0 });
    assertEquals(measure(500, 100), { now: 100, fraction: 1 });
    assertEquals(measure(3, 0).fraction, 0);
});

Deno.test("every tone is distinct", () => {
    assertEquals(new Set(TONES).size, TONES.length);
});

const runInit = (stored: string | null, attrs: Record<string, string> = {}) => {
    const set = { ...attrs };
    const root = {
        hasAttribute: (name: string) => name in set,
        setAttribute: (name: string, value: string) => {
            set[name] = value;
        },
    };
    new Function("localStorage", "document", themeInitScript)(
        {
            getItem: (key: string) => {
                assertEquals(key, STORAGE_KEY);
                return stored;
            },
        },
        { documentElement: root },
    );
    return set;
};

Deno.test("the theme init script paints what was saved", () => {
    assert(PAINTED.includes("theme"));
    assertEquals(runInit(JSON.stringify({ theme: "dusk" })), {
        "data-theme": "dusk",
    });
});

Deno.test("the theme init script leaves an existing attribute and bad data alone", () => {
    assertEquals(
        runInit(JSON.stringify({ theme: "dusk" }), { "data-theme": "x" }),
        { "data-theme": "x" },
    );
    assertEquals(runInit(null), {});
    assertEquals(runInit("{not json"), {});
    assertEquals(runInit(JSON.stringify({ theme: 3 })), {});
});
