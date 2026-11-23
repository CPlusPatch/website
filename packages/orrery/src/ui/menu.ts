/** The parts of a button that opens a menu of items. */
export type MenuParts = {
    button: HTMLElement;
    /** Everything that opens and closes with the button, the menu and anything beside it. */
    popup: HTMLElement;
    /** The element with `role="menu"`, which takes the arrow keys. */
    menu: HTMLElement;
    items: readonly HTMLElement[];
    /** Called when the menu opens or closes. */
    onToggle?: (open: boolean) => void;
};

/** How to open and close the menu, and how to remove its listeners. */
export type MenuControl = {
    open: () => void;
    close: (refocus: boolean) => void;
    isOpen: () => boolean;
    destroy: () => void;
};

/** Opens `popup` from `button`, moves focus with the arrow keys, and closes on Esc, Tab or a click outside. */
export const attachMenu = ({
    button,
    popup,
    menu,
    items,
    onToggle,
}: MenuParts): MenuControl => {
    popup.hidden = true;

    const isOpen = () => !popup.hidden;
    const open = () => {
        if (!popup.hidden) return;

        popup.hidden = false;
        button.setAttribute("aria-expanded", "true");
        items[0]?.focus();
        onToggle?.(true);
    };
    const close = (refocus: boolean) => {
        if (popup.hidden) return;

        popup.hidden = true;
        button.setAttribute("aria-expanded", "false");
        onToggle?.(false);
        if (refocus) button.focus();
    };

    button.addEventListener("click", () => {
        if (popup.hidden) open();
        else close(true);
    });
    button.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !popup.hidden) {
            // Otherwise the shortcut clears the selection and the menu stays.
            event.preventDefault();
            event.stopPropagation();
            close(true);
            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        if (popup.hidden) open();
        else items[0]?.focus();
    });
    menu.addEventListener("keydown", (event) => {
        const last = items.length - 1;
        const k = items.findIndex((entry) => entry === event.target);
        const to = {
            ArrowDown: k === last ? 0 : k + 1,
            ArrowUp: k <= 0 ? last : k - 1,
            Home: 0,
            End: last,
        }[event.key];

        if (to !== undefined) {
            event.preventDefault();
            items[to]?.focus();
        } else if (event.key === "Escape") {
            event.preventDefault();
            close(true);
        } else if (event.key === "Tab") {
            close(true);
        } else if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        // Space and Esc must not also reach the shortcuts.
        event.stopPropagation();
    });
    const onPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (
            target instanceof Node &&
            (popup.contains(target) || button.contains(target))
        ) {
            return;
        }

        close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);

    return {
        open,
        close,
        isOpen,
        destroy: () =>
            document.removeEventListener("pointerdown", onPointerDown),
    };
};
