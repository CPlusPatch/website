/// <reference types="deno" />

import { assertEquals } from "@std/assert";
import {
    isPlayMessage,
    isReadyMessage,
    playMessage,
    readyMessage,
    splitUrl,
} from "./play-frame.ts";

Deno.test("a url splits into its path and its query", () => {
    assertEquals(splitUrl("/gallery/play/a/b/?x=1&y=2"), {
        path: "/gallery/play/a/b/",
        query: "x=1&y=2",
    });
    assertEquals(splitUrl("/gallery/story/a/b/"), {
        path: "/gallery/story/a/b/",
        query: "",
    });
});

Deno.test("only a gallery-play message with a query is a play message", () => {
    assertEquals(isPlayMessage(playMessage("x=1")), true);
    assertEquals(isPlayMessage({ type: "gallery-play" }), false);
    assertEquals(isPlayMessage({ type: "other", query: "" }), false);
    assertEquals(isPlayMessage(null), false);
    assertEquals(isPlayMessage("gallery-play"), false);
});

Deno.test("a ready message is its own, and isn't a play message", () => {
    assertEquals(isReadyMessage(readyMessage()), true);
    assertEquals(isReadyMessage(playMessage("")), false);
    assertEquals(isReadyMessage(undefined), false);
    assertEquals(isPlayMessage(readyMessage()), false);
});
