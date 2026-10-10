/*
 * Alt+Shift keyboard shortcuts for form controls. Give an element
 * `data-shortcut="S"` and Alt+Shift+S clicks the inputs inside it: a switch
 * flips, and a radio group moves on to its next option. Inside a
 * [data-fine] element, a shortcut only works with a fine pointer, as the
 * control is hidden otherwise. Browser only.
 */

const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

// By physical key: on a Mac, Option+Shift+S types a symbol, not "S"
const shortcuts = new Map<string, HTMLElement>();

/**
 * Registers every [data-shortcut] in the scope, and marks the scope with
 * [data-shortcuts], so it can show their key hints.
 */
export const bindShortcuts = (scope: HTMLElement) => {
    for (const control of scope.querySelectorAll<HTMLElement>(
        "[data-shortcut]",
    )) {
        const key = control.dataset.shortcut?.toUpperCase();
        if (!key) continue;
        for (const input of control.querySelectorAll("input")) {
            input.setAttribute("aria-keyshortcuts", `Alt+Shift+${key}`);
        }
        shortcuts.set(`Key${key}`, control);
    }
    scope.toggleAttribute("data-shortcuts", true);
};

document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.repeat || e.isComposing) return;
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;

    const control = shortcuts.get(e.code);
    if (!control || (control.closest("[data-fine]") && !fine.matches)) return;

    const inputs = [...control.querySelectorAll("input")];
    const next =
        inputs[
            (inputs.findIndex((input) => input.checked) + 1) % inputs.length
        ];
    if (!next) return;

    e.preventDefault();
    // A click, so it fires change like picking it by hand
    next.click();
});
