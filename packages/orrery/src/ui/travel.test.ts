/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { type Edits, travel } from "./travel.ts";

const setup = (edits: Partial<Edits>) => {
    const log: string[] = [];
    const store: Edits = {
        canUndo: true,
        canRedo: true,
        undo: () => "a move",
        redo: () => "a move",
        ...edits,
    };
    const run = (kind: "undo" | "redo") =>
        travel(
            store,
            kind,
            () => log.push("closed"),
            (text) => log.push(text),
        );

    return { run, log };
};

Deno.test("an undo closes the forms, then says what it undid", () => {
    const { run, log } = setup({ undo: () => "the burn" });

    run("undo");

    assertEquals(log, ["closed", "Undid the burn."]);
});

Deno.test("a redo says what it redid", () => {
    const { run, log } = setup({ redo: () => "the burn" });

    run("redo");

    assertEquals(log, ["closed", "Redid the burn."]);
});

Deno.test("nothing to undo is said when the history is empty", () => {
    const { run, log } = setup({ canUndo: false, undo: () => null });

    run("undo");

    assertEquals(log, ["closed", "Nothing to undo."]);
});

Deno.test("a restore that failed says nothing, as it shows its own notice", () => {
    const { run, log } = setup({ canRedo: true, redo: () => null });

    run("redo");

    assertEquals(log, ["closed"]);
});
