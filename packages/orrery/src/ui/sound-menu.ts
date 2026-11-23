import { iconSvg } from "@cpluspatch/ui";
import type { Sound } from "../audio/sound.ts";
import { h, setText } from "./dom.ts";

/** The sound button, its menu and how to remove them. */
export type SoundMenu = {
    element: HTMLElement;
    destroy: () => void;
};

/** The button that opens the sound toggles, and the menu itself. */
export const createSoundMenu = (sound: Sound): SoundMenu => {
    const button = h("button", {
        type: "button",
        class: "orrery__sound-button",
        "aria-label": "Sound",
        "aria-haspopup": "menu",
        "aria-expanded": "false",
        "aria-controls": "orrery-sound-menu",
    });

    const item = (label: string) => {
        const entry = h(
            "button",
            {
                type: "button",
                class: "orrery__rate-item",
                role: "menuitemcheckbox",
                tabindex: "-1",
            },
            h("span", { class: "orrery__rate-word" }, label),
        );
        entry.insertAdjacentHTML("afterbegin", iconSvg("check"));

        return entry;
    };

    const effectsItem = item("Sound effects");
    const musicItem = item("Music");
    const items = [effectsItem, musicItem];
    const menu = h(
        "div",
        {
            id: "orrery-sound-menu",
            role: "menu",
            "aria-label": "Sound",
        },
        ...items,
    );
    const now = h("p", { class: "orrery__sound-now" });
    const popup = h("div", { class: "orrery__sound-menu" }, menu, now);
    popup.hidden = true;

    const element = h("span", { class: "orrery__sound" }, button, popup);

    const show = () => {
        const { settings, track } = sound;

        button.innerHTML = iconSvg(
            settings.effects || settings.music ? "volume-2" : "volume-x",
        );
        effectsItem.setAttribute("aria-checked", String(settings.effects));
        musicItem.setAttribute("aria-checked", String(settings.music));

        now.hidden = !settings.music || track === null;
        setText(now, track ? `Playing ${track.title}, ${track.artist}` : "");
    };

    const open = () => {
        popup.hidden = false;
        button.setAttribute("aria-expanded", "true");
        effectsItem.focus();
    };
    const close = (refocus: boolean) => {
        if (popup.hidden) return;

        popup.hidden = true;
        button.setAttribute("aria-expanded", "false");
        if (refocus) button.focus();
    };

    effectsItem.addEventListener("click", () => {
        sound.setEffects(!sound.settings.effects);
    });
    musicItem.addEventListener("click", () => {
        sound.setMusic(!sound.settings.music);
    });
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
            target instanceof Element &&
            target.closest(".orrery__sound-menu, .orrery__sound-button")
        ) {
            return;
        }

        close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);

    const off = sound.onChange(show);
    show();

    return {
        element,
        destroy: () => {
            off();
            document.removeEventListener("pointerdown", onPointerDown);
            element.remove();
        },
    };
};
