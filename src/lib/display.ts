/*
 * The Display menu's choices (theme, overrides and effects), kept across
 * pages in localStorage. Without JS the browser's own form restoration keeps
 * them instead, though only on the page they were made on.
 *
 * Browser only, apart from STORAGE_KEY, which layouts/base.astro hands to its
 * head script: that applies the saved theme and overrides before first paint.
 */
import { THEMES } from "../styles/themes/index.ts";

export const STORAGE_KEY = "display";

/** A radio group's checked value, or a switch's state, by input name. */
type Choices = Record<string, string | boolean>;

const loadChoices = (): Choices => {
    try {
        const choices = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        return choices && typeof choices === "object" ? choices : {};
    } catch {
        // Blocked storage or a mangled value: start from the page's defaults
        return {};
    }
};

const saveChoice = (name: string, value: string | boolean) => {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...loadChoices(), [name]: value }),
        );
    } catch {
        // Blocked storage: the choice lasts as long as the page
    }
};

/*
 * Show the saved choices on the controls, which then apply them. The first
 * time, this takes over from the head script: what it painted onto <html>
 * as data-<name>, or what <html> was given, moves onto the radio group of
 * that name.
 */
const restore = (inputs: HTMLInputElement[]) => {
    const root = document.documentElement;
    const saved = loadChoices();
    const painted = new Set<string>();
    for (const input of inputs) {
        let choice: string | boolean | undefined = saved[input.name];
        if (input.type === "radio") {
            const attr = `data-${input.name}`;
            choice ??= root.getAttribute(attr) ?? undefined;
            painted.add(attr);
        }
        if (choice === undefined) continue;
        input.checked =
            input.type === "radio" ? input.value === choice : choice === true;
    }
    for (const attr of painted) root.removeAttribute(attr);
};

/** Restores and saves the inputs in the menu's [data-persist] controls. */
export const bindDisplayMenu = (menu: HTMLElement) => {
    const inputs = [
        ...menu.querySelectorAll<HTMLInputElement>("[data-persist] input"),
    ];
    restore(inputs);
    // Back to a page kept whole in the cache, as it was before a later change
    window.addEventListener("pageshow", (e) => e.persisted && restore(inputs));

    menu.addEventListener("change", (e) => {
        const input = e.target;
        if (!(input instanceof HTMLInputElement) || !inputs.includes(input))
            return;
        saveChoice(
            input.name,
            input.type === "radio" ? input.value : input.checked,
        );
    });
};

const picker = (value?: string) =>
    document.querySelector<HTMLInputElement>(
        `[data-theme-select] input${value ? `[value="${value}"]` : ":checked"}`,
    );

/** The theme on screen, picked in the menu or set on <html>. */
export const currentTheme = (): string =>
    picker()?.value ?? document.documentElement.dataset.theme ?? "default";

/**
 * Switches theme through the menu, as if picked there, or through <html> on
 * a page without one. Returns the theme, or undefined if there's no such
 * theme.
 */
export const setTheme = (name: string) => {
    const theme = THEMES.find(({ value }) => value === name);
    if (!theme) return undefined;

    const input = picker(name);
    if (input) {
        // A click, so it fires change (and saves) like picking it by hand
        input.click();
    } else {
        const root = document.documentElement;
        if (name === "default") delete root.dataset.theme;
        else root.dataset.theme = name;
        saveChoice("theme", name);
    }
    return theme;
};
