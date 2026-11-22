import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { h } from "./dom.ts";

/** The keys card, the button that opens it and how to remove them. */
export type Keys = {
    toggle: HTMLButtonElement;
    card: HTMLElement;
    /** Closes the card. Returns whether it was open. */
    close: () => boolean;
    destroy: () => void;
};

/** The keys that work, as the keys to press and what they do. */
const KEYS: [keys: string[], what: string][] = [
    [["/"], "Search bodies"],
    [["Space"], "Run or hold"],
    [["[", "]"], "Slower, faster"],
    [["R"], "Reverse"],
    [["L"], "Go live"],
    [["T"], "Set the date"],
    [["U"], "Switch km and AU"],
    [["←", "→"], "Scrub the focused timeline"],
    [["F"], "Focus the picked body"],
    [["Arrows"], "Turn the view"],
    [["+", "−"], "Zoom in, out"],
    [["0"], "Fit the focus"],
    [["Esc"], "Close, or clear the pick"],
];

/** A card that lists the keyboard shortcuts, and the "?" button that toggles it. */
export const createKeys = (): Keys => {
    const toggle = h(
        "button",
        {
            type: "button",
            class: "orrery__keys-toggle",
            "aria-label": "Keyboard keys",
            "aria-expanded": "false",
            "aria-controls": "orrery-keys",
        },
        h("span", { "aria-hidden": "true" }, "?"),
    );

    const closeButton = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Close keys",
    });
    closeButton.innerHTML = iconSvg("x");

    const card = h(
        "section",
        {
            id: "orrery-keys",
            class: `${cardClasses().join(" ")} orrery__keys`,
            "aria-labelledby": "orrery-keys-title",
        },
        h(
            "div",
            { class: "orrery__inspector-head orrery__inspector-head--panel" },
            h(
                "h2",
                { class: "orrery__panel-title", id: "orrery-keys-title" },
                "Keys",
            ),
            closeButton,
        ),
        h(
            "dl",
            { class: "orrery__keys-list" },
            ...KEYS.flatMap(([keys, what]) => [
                h("dt", {}, ...keys.map((key) => h("kbd", {}, key))),
                h("dd", {}, what),
            ]),
        ),
    );
    card.hidden = true;

    const show = (open: boolean) => {
        card.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
    };

    const onToggle = () => show(Boolean(card.hidden));
    const onClose = () => {
        show(false);
        toggle.focus();
    };
    toggle.addEventListener("click", onToggle);
    closeButton.addEventListener("click", onClose);

    return {
        toggle,
        card,
        close: () => {
            if (card.hidden) return false;

            // Hiding the card would drop focus to <body>.
            const held = card.contains(document.activeElement);
            show(false);
            if (held) toggle.focus();

            return true;
        },
        destroy: () => {
            toggle.removeEventListener("click", onToggle);
            closeButton.removeEventListener("click", onClose);
            toggle.remove();
            card.remove();
        },
    };
};
