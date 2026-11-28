/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import { imageName, markup } from "./source.ts";

Deno.test("a dev image src loses its /@fs path and query", () => {
    assertEquals(
        imageName(
            "/@fs/home/user/site/src/assets/foo.png?origWidth=800&origHeight=600&origFormat=png",
        ),
        "foo.png",
    );
});

Deno.test("a build image src keeps its hashed file name", () => {
    assertEquals(imageName("/_astro/foo.Ab12.webp"), "foo.Ab12.webp");
});

Deno.test("a short tag stays on one line", () => {
    assertEquals(
        markup("Button", { variant: "solid" }, ["Go"]),
        '<Button variant="solid">Go</Button>',
    );
});

Deno.test("a long tag puts each attribute on its own line, with the > on the last", () => {
    const props = { variant: "soft-edge", tone: "secondary", size: "sm" };

    assertEquals(
        markup("Button", props, ["Go"]),
        '<Button\n    variant="soft-edge"\n    tone="secondary"\n    size="sm">\n    Go\n</Button>',
    );
    assertEquals(
        markup("Button", props, []),
        '<Button\n    variant="soft-edge"\n    tone="secondary"\n    size="sm" />',
    );
});
