/**
 * <Terminal> with `interactive`: a command line with history. What the
 * commands are is the page's business, so `run` is passed in; this does the
 * input, the history, and appending rows.
 *
 * Root: `[data-terminal]`. Needs a direct-child `<template>` holding one
 * row (`.terminal__pair` with a `.terminal__command` and a
 * `.terminal__output`), rows as direct `.terminal__pair` children, and a
 * `.terminal__input` row, before which new rows go, with an <input> in it.
 * Rows already there seed the history.
 *
 * Not part of initAll (see index.ts), as it can't work without `run`.
 */
import { behaviour } from "./behaviour.ts";

/**
 * A command that runs on after it returns, drawing into its output itself.
 * It calls `done` when it finishes, and returns a function that stops it
 * sooner, called on Ctrl+C or the next command.
 */
export type Program = (output: HTMLElement, done: () => void) => () => void;

/** What a command returns to have the terminal empty itself, like `clear`. */
export const CLEAR = Symbol("clear");

/** What running a command line gives: text to print, a program, or CLEAR. */
export type TerminalResult = string | Program | typeof CLEAR;

export interface TerminalOptions {
    /** Runs a line the reader entered. */
    run: (line: string) => TerminalResult;
}

interface TerminalState {
    history: string[];
    cursor: number; // Index into history; history.length = live input
    draft: string; // In-progress input saved while browsing history
    stop?: () => void; // Stops the program still running (see Program)
}

/** Adds a row for the command, and returns its output, for a program to fill. */
const appendRow = (root: HTMLElement, command: string, output: string) => {
    const row = (
        root.querySelector<HTMLTemplateElement>(
            ":scope > template",
        ) as HTMLTemplateElement
    ).content.cloneNode(true) as DocumentFragment;
    (row.querySelector(".terminal__command") as HTMLElement).textContent =
        command;
    const outputElement = row.querySelector(".terminal__output") as HTMLElement;
    outputElement.textContent = output;
    (root.querySelector(".terminal__input") as HTMLElement).before(row);
    root.scrollTop = root.scrollHeight;
    return outputElement;
};

const terminal = behaviour<HTMLElement, TerminalOptions>(
    "[data-terminal]",
    (root, signal, options) => {
        if (!options) {
            throw new Error("initTerminal needs a `run` option.");
        }
        const { run } = options;

        // Seed from SSR'd rows so pre-rendered commands are navigable
        const history = Array.from(
            root.querySelectorAll(".terminal__command"),
            (el) => el.textContent ?? "",
        );
        const state: TerminalState = {
            history,
            cursor: history.length,
            draft: "",
        };

        root.addEventListener(
            "keydown",
            (e) => {
                if (e.isComposing) return;

                const field = e.target;
                if (!(field instanceof HTMLInputElement)) return;

                // Like a shell: Ctrl+C stops what's running, rather than copying.
                if (e.ctrlKey && e.key === "c" && state.stop) {
                    state.stop();
                    state.stop = undefined;
                    e.preventDefault();
                    return;
                }

                switch (e.key) {
                    case "Enter": {
                        const command = field.value.trim();
                        if (!command) return;
                        field.value = "";

                        state.stop?.();
                        state.stop = undefined;
                        const result = run(command);
                        if (result === CLEAR) {
                            for (const row of root.querySelectorAll(
                                ":scope > .terminal__pair",
                            )) {
                                row.remove();
                            }
                        } else if (typeof result === "string") {
                            appendRow(root, command, result);
                        } else {
                            const stop = result(
                                appendRow(root, command, ""),
                                () => {
                                    // Unless it was stopped already, and another started.
                                    if (state.stop === stop)
                                        state.stop = undefined;
                                },
                            );
                            state.stop = stop;
                        }

                        state.history.push(command);
                        state.cursor = state.history.length;
                        state.draft = "";
                        break;
                    }
                    case "ArrowUp": {
                        if (state.cursor === 0) return;
                        if (state.cursor === state.history.length)
                            state.draft = field.value;
                        field.value = state.history[--state.cursor];
                        e.preventDefault(); // Keeps the caret at the end
                        break;
                    }
                    case "ArrowDown": {
                        if (state.cursor >= state.history.length) return;
                        state.cursor++;
                        field.value =
                            state.cursor === state.history.length
                                ? state.draft
                                : state.history[state.cursor];
                        e.preventDefault();
                        break;
                    }
                }
            },
            { signal },
        );

        // The rows it added stay, as they are the reader's record; the
        // program still running does not.
        return () => {
            state.stop?.();
            state.stop = undefined;
        };
    },
);

export const initTerminal = terminal.init;
export const initTerminals = terminal.initAll;
