import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

/**
 * Moves the panel into `root`, and closes it on Escape or on Tab past `last()`.
 * The panel must cover the scene without moving the label band, and the CSS positions it
 * against the root, so it can't stay in the top bar.
 * The keys are native: a delegated handler would run after the shortcuts on the document.
 */
export const panelHost =
    (
        root: HTMLElement,
        last: () => EventTarget | null | undefined,
        close: () => void,
    ): Attachment<HTMLElement> =>
    (node) => {
        root.append(node);

        const off = on(node, "keydown", (event) => {
            // Tab past the last control lands where Escape does, not on the page body.
            const leaving =
                event.key === "Tab" &&
                !event.shiftKey &&
                event.target === last();
            if (event.key === "Escape" || leaving) {
                event.preventDefault();
                close();
            }
        });

        return () => {
            off();
            node.remove();
        };
    };
