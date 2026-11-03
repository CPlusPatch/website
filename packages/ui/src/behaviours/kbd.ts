/**
 * <Kbd>: on Apple devices, swaps the PC modifier names for their symbols
 * (⌥ ⇧ ⌃ ⌘) and drops the plus between them.
 *
 * Root: `.kbd`. Each `.kbd__key[data-key]` inside holds a key name
 * (Alt, Shift, Ctrl, Meta); other keys are left alone. The root gets
 * `data-apple` when any were swapped, for the CSS.
 */
import { behaviour } from "./behaviour.ts";

const APPLE: Record<string, [symbol: string, name: string]> = {
    Alt: ["⌥", "Option"],
    Shift: ["⇧", "Shift"],
    Ctrl: ["⌃", "Control"],
    Meta: ["⌘", "Command"],
};

const isApple = () => {
    const platform =
        (navigator as { userAgentData?: { platform: string } }).userAgentData
            ?.platform ?? navigator.platform;
    return /mac|iphone|ipad/i.test(platform);
};

const kbd = behaviour(".kbd", (root) => {
    if (!isApple()) return;

    const swapped: [key: HTMLElement, text: string, title: string | null][] =
        [];
    for (const key of root.querySelectorAll<HTMLElement>(
        ".kbd__key[data-key]",
    )) {
        const apple = APPLE[key.dataset.key ?? ""];
        if (!apple) continue;
        swapped.push([key, key.textContent ?? "", key.getAttribute("title")]);
        [key.textContent, key.title] = apple;
    }
    if (!swapped.length) return;
    root.toggleAttribute("data-apple", true);

    return () => {
        root.removeAttribute("data-apple");
        for (const [key, text, title] of swapped) {
            key.textContent = text;
            if (title === null) key.removeAttribute("title");
            else key.title = title;
        }
    };
});

export const initKbd = kbd.init;
export const initKbds = kbd.initAll;
