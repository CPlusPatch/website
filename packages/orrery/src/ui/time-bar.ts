import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { RATES } from "../clock.ts";
import {
    formatUtc,
    fromDatetimeLocal,
    rateLabel,
    toDatetimeLocal,
} from "../format.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The time bar's element and how to remove it. */
export type TimeBar = {
    element: HTMLElement;
    destroy: () => void;
};

/** How often the shown time refreshes while the clock runs, in ms. */
const REFRESH_MS = 250;

const key = (name: string, label: string): HTMLElement =>
    h(
        "span",
        { class: "kbd" },
        h("kbd", { class: "kbd__key" }, name),
        ` ${label}`,
    );

/** The play, speed and date controls of a world's clock. */
export const createTimeBar = (world: World): TimeBar => {
    const { clock } = world;

    const play = h("button", {
        type: "button",
        class: buttonClasses({
            size: "icon",
            variant: "outline",
            tone: "neutral",
        }).join(" "),
        "aria-label": "Pause",
    });

    const reverse = h(
        "button",
        {
            type: "button",
            class: buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            ),
        },
        "Reverse",
    );

    const rate = h(
        "select",
        { class: "select", "aria-label": "Speed" },
        ...RATES.map((preset) =>
            h(
                "option",
                { value: String(preset) },
                `${rateLabel(preset)} per second`,
            ),
        ),
    );

    const time = h("time", { class: "orrery__time" });

    const jump = h("input", {
        id: "orrery-jump",
        type: "datetime-local",
        class: "field input",
    });

    const now = h(
        "button",
        {
            type: "button",
            class: buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            ),
        },
        "Now",
    );

    const element = h(
        "div",
        {
            class: `${cardClasses().join(" ")} orrery__time-bar`,
            role: "group",
            "aria-label": "Time",
        },
        play,
        reverse,
        rate,
        time,
        h(
            "span",
            { class: "orrery__time-jump" },
            h("label", { for: "orrery-jump" }, "Jump to"),
            jump,
            now,
        ),
        h(
            "span",
            { class: "orrery__time-keys" },
            key("Space", "play/pause"),
            key("[ ]", "speed"),
            key("R", "reverse"),
            key("F", "focus"),
            key("Esc", "deselect"),
        ),
    );

    const showTime = () => {
        const text = formatUtc(clock.t);
        const value = toDatetimeLocal(clock.t);

        if (time.textContent !== text) time.textContent = text;
        time.setAttribute("datetime", value && `${value}Z`);

        // Typing a date isn't interrupted.
        if (document.activeElement !== jump && jump.value !== value) {
            jump.value = value;
        }
    };

    const show = () => {
        play.setAttribute("aria-pressed", String(clock.paused));
        play.innerHTML = iconSvg(clock.paused ? "play" : "pause");
        reverse.setAttribute("aria-pressed", String(clock.rate < 0));
        rate.value = String(Math.abs(clock.rate));
        showTime();
    };

    play.addEventListener("click", () => {
        world.setClock({ paused: !clock.paused });
    });
    reverse.addEventListener("click", () => {
        world.setClock({ rate: -clock.rate });
    });
    rate.addEventListener("change", () => {
        const speed = Number(rate.value);
        world.setClock({ rate: clock.rate < 0 ? -speed : speed });
    });
    jump.addEventListener("change", () => {
        const t = fromDatetimeLocal(jump.value);
        if (t !== null) world.setClock({ t });
    });
    now.addEventListener("click", () => {
        world.setClock({ t: unixMsToJ2000s(Date.now()) });
    });

    const off = world.on((event) => {
        if (event.type === "clock") show();
    });
    const interval = setInterval(showTime, REFRESH_MS);
    show();

    return {
        element,
        destroy: () => {
            off();
            clearInterval(interval);
            element.remove();
        },
    };
};
