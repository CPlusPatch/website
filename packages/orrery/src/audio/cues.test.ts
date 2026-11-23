/// <reference types="deno" />
import { assert, assertEquals } from "@std/assert";
import { clearCuePlayer, cue, setCuePlayer, shouldPlay } from "./cues.ts";

const never = { cue: Number.NEGATIVE_INFINITY, tick: Number.NEGATIVE_INFINITY };

Deno.test("a cue plays when none has played before", () => {
    assert(shouldPlay("select", 0, never));
    assert(shouldPlay("tick", 0, never));
});

Deno.test("a cue within 150 ms of the last one is dropped", () => {
    const last = { cue: 1000, tick: never.tick };

    assertEquals(shouldPlay("select", 1149, last), false);
    assertEquals(shouldPlay("edit", 1100, last), false);
    assert(shouldPlay("select", 1150, last));
});

Deno.test("a tick doesn't count towards the gap between cues", () => {
    const last = { cue: never.cue, tick: 1000 };

    assert(shouldPlay("select", 1010, last));
});

Deno.test("a cue doesn't hold back a tick", () => {
    const last = { cue: 1000, tick: never.tick };

    assert(shouldPlay("tick", 1010, last));
});

Deno.test("ticks are limited to one per 60 ms", () => {
    const last = { cue: never.cue, tick: 1000 };

    assertEquals(shouldPlay("tick", 1059, last), false);
    assert(shouldPlay("tick", 1060, last));
});

Deno.test("cue does nothing without a player", () => {
    setCuePlayer(null);

    cue("select");
});

Deno.test("cue forwards to the player and drops a quick follow-up", () => {
    const played: string[] = [];
    setCuePlayer((name) => played.push(name));

    cue("add");
    cue("select");
    setCuePlayer(null);

    assertEquals(played, ["add"]);
});

Deno.test("a new player starts with no gap from the old one", () => {
    setCuePlayer(() => {});
    cue("select");

    const played: string[] = [];
    setCuePlayer((name) => played.push(name));
    cue("select");
    setCuePlayer(null);

    assertEquals(played, ["select"]);
});

Deno.test("clearCuePlayer leaves a newer player in place", () => {
    const old = () => {};
    const played: string[] = [];
    setCuePlayer(old);
    setCuePlayer((name) => played.push(name));

    clearCuePlayer(old);
    cue("select");
    setCuePlayer(null);

    assertEquals(played, ["select"]);
});

Deno.test("clearCuePlayer silences its own player", () => {
    const played: string[] = [];
    const player = (name: string) => played.push(name);
    setCuePlayer(player);

    clearCuePlayer(player);
    cue("select");

    assertEquals(played, []);
});
