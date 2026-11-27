/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import { imageName } from "./source.ts";

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
