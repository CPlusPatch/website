/**
 * <Code>: reveals the copy button and copies the block's text on press.
 * Without script there is no button rather than a dead one.
 *
 * Root: `.code` (the block's <figure>). Needs a `.code__copy` button (hidden
 * until script runs) and `pre code` to copy; optionally a `.code__status`
 * live region, which says "Copied". `data-copied` is set on the button for
 * two seconds afterwards, for the CSS.
 */
import { behaviour } from "./behaviour.ts";

const code = behaviour(".code", (root, signal) => {
    const button = root.querySelector<HTMLButtonElement>(".code__copy");
    const source = root.querySelector("pre code");
    const status = root.querySelector(".code__status");
    if (!button || !source || !navigator.clipboard) return;
    button.hidden = false;

    let timer = 0;
    button.addEventListener(
        "click",
        async () => {
            await navigator.clipboard.writeText(source.textContent ?? "");
            button.dataset.copied = "";
            if (status) status.textContent = "Copied";
            clearTimeout(timer);
            timer = window.setTimeout(() => {
                delete button.dataset.copied;
                if (status) status.textContent = "";
            }, 2000);
        },
        { signal },
    );

    return () => {
        clearTimeout(timer);
        delete button.dataset.copied;
        if (status) status.textContent = "";
        button.hidden = true;
    };
});

export const initCode = code.init;
export const initCodes = code.initAll;
