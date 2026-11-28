/**
 * <Combobox>: an editable combobox with list autocomplete (the ARIA
 * Authoring Practices pattern of that name).
 *
 * Root: `.combobox`, holding `input[role=combobox]`, an optional
 * `.combobox__icon`, `.combobox__chevron`, `[role=listbox]` with one
 * `[role=option]` per option (its `data-value` is the value), and
 * `.combobox__empty`, a status that says "No matches".
 * Typing filters the options. Only an option can be the value: leaving the
 * field puts the last pick back. A pick fires a bubbling `comboboxchange`
 * event on the root, with the value in `detail.value`. The root gets
 * `data-ready`, which the CSS waits for before it shows the chevron.
 */
import { behaviour } from "./behaviour.ts";

/** The options whose label or value has the query in it, in any case. */
export const filterOptions = <T extends { value: string; label: string }>(
    options: readonly T[],
    query: string,
): T[] => {
    const needle = query.trim().toLowerCase();

    return options.filter(
        (option) =>
            option.label.toLowerCase().includes(needle) ||
            option.value.toLowerCase().includes(needle),
    );
};

/**
 * Where a key moves the active option to, with -1 for none: the arrows wrap.
 * Home and End are the caret's while the list is closed, so they only act open.
 */
export const nextActiveIndex = (
    key: string,
    index: number,
    count: number,
    open: boolean,
): number | undefined => {
    if (count <= 0) return undefined;

    switch (key) {
        case "ArrowDown":
            return (index + 1) % count;
        case "ArrowUp":
            return index < 0 ? count - 1 : (index - 1 + count) % count;
        case "Home":
            return open ? 0 : undefined;
        case "End":
            return open ? count - 1 : undefined;
        default:
            return undefined;
    }
};

/**
 * Where the active option starts when the list opens, with -1 for none.
 * A typed filter starts on its first match. Otherwise the pick is active if it's shown.
 * `typed` is the input's text, or undefined when the list was opened without typing.
 */
export const startIndex = (
    shown: readonly { value: string }[],
    picked: string | undefined,
    typed: string | undefined,
): number => {
    if (shown.length === 0) return -1;
    if (typed?.trim()) return 0;

    const pick = shown.findIndex((option) => option.value === picked);
    if (pick >= 0) return pick;

    return typed === undefined ? -1 : 0;
};

const combobox = behaviour(".combobox", (root, signal) => {
    const input = root.querySelector<HTMLInputElement>("input[role=combobox]");
    const listbox = root.querySelector<HTMLElement>("[role=listbox]");
    const empty = root.querySelector<HTMLElement>(".combobox__empty");
    const chevron = root.querySelector<HTMLElement>(".combobox__chevron");
    if (!input || !listbox || !empty) return;

    const all = [...listbox.querySelectorAll<HTMLElement>("[role=option]")];
    const choices = all.map((element) => ({
        element,
        value: element.dataset.value ?? "",
        label:
            element.querySelector(".combobox__label")?.textContent?.trim() ??
            "",
    }));

    let picked = input.value;
    let open = false;
    let shown: typeof choices = [];
    let active = -1;

    const render = (scroll = true) => {
        const expanded = open && shown.length > 0;

        listbox.hidden = !expanded;
        input.setAttribute("aria-expanded", String(expanded));
        empty.textContent = open && shown.length === 0 ? "No matches" : "";
        for (const choice of choices) {
            choice.element.hidden = !shown.includes(choice);
            choice.element.toggleAttribute(
                "data-active",
                shown[active] === choice,
            );
        }

        const current = shown[active];
        if (expanded && current) {
            input.setAttribute("aria-activedescendant", current.element.id);
            if (scroll) current.element.scrollIntoView({ block: "nearest" });
        } else {
            input.removeAttribute("aria-activedescendant");
        }
    };

    const show = (query: string, typed: boolean) => {
        open = true;
        shown = filterOptions(choices, query);
        active = startIndex(shown, picked, typed ? query : undefined);
        render();
    };

    const close = () => {
        open = false;
        active = -1;
        render();
    };

    /** The field's icon is a copy of the picked option's, so it needs no icon lookup. */
    const showIcon = (choice: (typeof choices)[number] | undefined) => {
        root.querySelector(".combobox__icon")?.remove();

        const svg = choice?.element.querySelector("svg");
        if (!svg) return;

        const icon = document.createElement("span");
        icon.className = "combobox__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.append(svg.cloneNode(true));
        root.prepend(icon);
    };

    const restore = () => {
        input.value = picked;
    };

    const pick = (choice: (typeof choices)[number]) => {
        const changed = choice.value !== picked;

        picked = choice.value;
        restore();
        for (const other of choices) {
            other.element.setAttribute(
                "aria-selected",
                String(other === choice),
            );
        }
        showIcon(choice);
        close();

        if (changed) {
            root.dispatchEvent(
                new CustomEvent("comboboxchange", {
                    bubbles: true,
                    detail: { value: picked },
                }),
            );
        }
    };

    input.addEventListener("input", () => show(input.value, true), { signal });

    input.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Enter") {
                const choice = shown[active];
                if (!open || !choice) return;

                event.preventDefault();
                pick(choice);
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                if (open) close();
                else restore();
                return;
            }

            const next = nextActiveIndex(
                event.key,
                active,
                open ? shown.length : choices.length,
                open,
            );
            if (next === undefined) return;

            event.preventDefault();
            if (!open) {
                show("", false);
                // The arrow that opens the list only lands on the pick.
                if (active >= 0) return;
            }
            active = next;
            render();
        },
        { signal },
    );

    // Keeps the focus in the input, so picking an option isn't a blur.
    root.addEventListener(
        "pointerdown",
        (event) => {
            const target = event.target as Element;
            if (
                target.closest("[role=listbox]") ||
                target.closest(".combobox__chevron")
            ) {
                event.preventDefault();
            }
        },
        { signal },
    );

    // A pointermove, not a hover: the list scrolling under a still pointer mustn't steal the active option.
    listbox.addEventListener(
        "pointermove",
        (event) => {
            const element = (event.target as Element).closest<HTMLElement>(
                "[role=option]",
            );
            const index = shown.findIndex((item) => item.element === element);
            if (index < 0 || index === active) return;

            active = index;
            render(false);
        },
        { signal },
    );

    listbox.addEventListener(
        "click",
        (event) => {
            const element = (event.target as Element).closest<HTMLElement>(
                "[role=option]",
            );
            const choice = choices.find((item) => item.element === element);
            if (choice) pick(choice);
        },
        { signal },
    );

    chevron?.addEventListener(
        "click",
        () => {
            input.focus();
            if (open) close();
            else show("", false);
        },
        { signal },
    );

    root.addEventListener(
        "focusout",
        (event) => {
            if (root.contains(event.relatedTarget as Node | null)) return;

            restore();
            close();
        },
        { signal },
    );

    root.toggleAttribute("data-ready", true);

    return () => root.removeAttribute("data-ready");
});

export const initCombobox = combobox.init;
export const initComboboxes = combobox.initAll;
