/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import { playPath, storyPath } from "./story.ts";

Deno.test("a story's page and its live page are under their own roots", () => {
    assertEquals(
        storyPath("button-variant", "default"),
        "/gallery/story/button-variant/default/",
    );
    assertEquals(
        playPath("button-variant", "default"),
        "/gallery/play/button-variant/default/",
    );
});
