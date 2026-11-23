import { iconSvg } from "@cpluspatch/ui";
import type { Sound } from "../audio/sound.ts";
import { h, setText } from "./dom.ts";
import { attachMenu } from "./menu.ts";

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

    const control = attachMenu({ button, popup, menu, items });

    effectsItem.addEventListener("click", () => {
        sound.setEffects(!sound.settings.effects);
    });
    musicItem.addEventListener("click", () => {
        sound.setMusic(!sound.settings.music);
    });
    const off = sound.onChange(show);
    show();

    return {
        element,
        destroy: () => {
            off();
            control.destroy();
            element.remove();
        },
    };
};
