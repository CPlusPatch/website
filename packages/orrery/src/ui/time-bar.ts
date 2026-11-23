import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { cue } from "../audio/cues.ts";
import type { Sound } from "../audio/sound.ts";
import { RATES } from "../clock.ts";
import { PART_NAMES, type PartName } from "../date-parts.ts";
import type { SavedStorage } from "../persistence.ts";
import { isLive, offsetText, rateText, stampParts } from "../time-text.ts";
import type { World } from "../world.ts";
import { createDateEditor } from "./date-editor.ts";
import { h, setText } from "./dom.ts";
import { createSoundMenu } from "./sound-menu.ts";
import { createTimeline } from "./timeline/timeline.ts";

/** The time bar's element and how to drive it. */
export type TimeBar = {
    element: HTMLElement;
    /** Sets the clock to the real time at 1 sec/s, running. */
    goLive: () => void;
    /** Opens the date editor, or closes it if it's open. */
    toggleDate: () => void;
    destroy: () => void;
};

/** How often the shown time refreshes while the clock runs, in ms. */
const REFRESH_MS = 250;

/** The index in `RATES` of the preset a rate snaps to, by magnitude. */
const presetOf = (rate: number): number =>
    Math.max(
        RATES.findLastIndex((preset) => Math.abs(rate) >= preset),
        0,
    );

/**
 * The run and rate controls, the date, the live status, the sound menu and the timeline of a
 * world's clock.
 */
export const createTimeBar = (
    world: World,
    storage: SavedStorage,
    sound: Sound,
): TimeBar => {
    const { clock } = world;

    const run = h("button", { type: "button", class: "orrery__run" });

    const rateLabel = h("span", { class: "orrery__rate-label" });
    const rateButton = h(
        "button",
        {
            type: "button",
            class: "orrery__rate",
            "aria-haspopup": "menu",
            "aria-expanded": "false",
            "aria-controls": "orrery-rate-menu",
        },
        rateLabel,
    );
    rateButton.insertAdjacentHTML("beforeend", iconSvg("chevron-down"));

    const menuItem = (role: string, ...children: (Node | string)[]) => {
        const item = h(
            "button",
            {
                type: "button",
                class: "orrery__rate-item",
                role,
                tabindex: "-1",
            },
            ...children,
        );
        item.insertAdjacentHTML("afterbegin", iconSvg("check"));

        return item;
    };

    const rateItems = RATES.map((preset) =>
        menuItem("menuitemradio", h("span", {}, rateText(preset))),
    );
    const reverseItem = menuItem(
        "menuitemcheckbox",
        h("span", { class: "orrery__rate-word" }, "Reverse"),
        h("span", { class: "orrery__rate-key", "aria-hidden": "true" }, "R"),
    );
    reverseItem.setAttribute("aria-keyshortcuts", "R");

    // The fastest rate is at the top.
    const fastestFirst = rateItems.toReversed();
    const menuItems = [...fastestFirst, reverseItem];
    const rateMenu = h(
        "div",
        {
            id: "orrery-rate-menu",
            class: "orrery__rate-menu",
            role: "menu",
            "aria-label": "Time warp",
        },
        ...fastestFirst,
        h("div", { class: "orrery__rate-rule", role: "separator" }),
        reverseItem,
    );
    rateMenu.hidden = true;

    const part = (name: PartName) =>
        h("span", { class: "orrery__date-digits", "data-part": name });
    const parts = {
        y: part("y"),
        mo: part("mo"),
        d: part("d"),
        h: part("h"),
        mi: part("mi"),
        s: part("s"),
    };
    const time = h(
        "time",
        {},
        parts.y,
        "-",
        parts.mo,
        "-",
        parts.d,
        h(
            "span",
            { class: "orrery__tod" },
            " ",
            parts.h,
            ":",
            parts.mi,
            h("span", { class: "orrery__secs" }, ":", parts.s),
            h("span", { class: "orrery__utc" }, " UTC"),
        ),
    );
    const date = h(
        "button",
        {
            type: "button",
            class: "orrery__date",
            title: "Set the date (T)",
            "aria-expanded": "false",
            "aria-controls": "orrery-date-editor",
        },
        // The name holds the visible date, so voice control can say what's shown.
        h("span", { class: "visually-hidden" }, "Set the date, "),
        time,
    );

    const liveFull = h("span", { class: "orrery__live-full" });
    const liveShort = h("span", { class: "orrery__live-short" });
    const liveWord = h("span", { class: "orrery__live-word" });
    const goLiveButton = h(
        "button",
        {
            type: "button",
            class: "orrery__go-live",
            title: "Real time at 1 sec/s (L)",
        },
        "Go live",
    );
    const live = h(
        "div",
        { class: "orrery__live" },
        h(
            "span",
            { class: "orrery__live-state", role: "status" },
            h("span", { class: "orrery__live-dot", "aria-hidden": "true" }),
            h("span", { class: "orrery__live-on" }, "Live"),
            h(
                "span",
                // At fast rates this changes every refresh, so only Live is announced.
                { class: "orrery__live-offset", "aria-live": "off" },
                liveFull,
                liveShort,
                " ",
                liveWord,
            ),
        ),
        goLiveButton,
    );

    const soundMenu = createSoundMenu(sound);
    live.append(soundMenu.element);

    const editor = createDateEditor(world, date);
    const timeline = createTimeline(world, storage);

    const element = h(
        "div",
        { class: "orrery__clock", role: "group", "aria-label": "Time" },
        h("div", { class: "orrery__split" }, run, rateButton, rateMenu),
        date,
        live,
        timeline.element,
        editor.element,
    );

    const goLive = () => {
        world.setClock({
            t: unixMsToJ2000s(Date.now()),
            rate: 1,
            paused: false,
        });
    };

    let shownPaused: boolean | null = null;

    const showRun = () => {
        run.classList.toggle("orrery__run--held", clock.paused);
        run.setAttribute(
            "aria-label",
            clock.paused ? "Held. Run time" : "Running. Hold time",
        );
        if (shownPaused === clock.paused) return;

        shownPaused = clock.paused;
        run.innerHTML = iconSvg(clock.paused ? "pause" : "play");
    };

    const showRate = () => {
        const current = presetOf(clock.rate);

        element.classList.toggle("orrery__clock--reverse", clock.rate < 0);
        setText(rateLabel, rateText(clock.rate));
        rateItems.forEach((item, k) => {
            item.setAttribute("aria-checked", String(k === current));
        });
        reverseItem.setAttribute("aria-checked", String(clock.rate < 0));
    };

    const showTime = () => {
        const nowT = unixMsToJ2000s(Date.now());
        const stamp = stampParts(clock.t, clock.rate);

        for (const name of PART_NAMES) {
            setText(parts[name], stamp[name].text);
            parts[name].classList.toggle("orrery__fast", stamp[name].fast);
        }
        const value = `${stamp.y.text}-${stamp.mo.text}-${stamp.d.text}T${stamp.h.text}:${stamp.mi.text}:${stamp.s.text}Z`;
        if (time.getAttribute("datetime") !== value) {
            time.setAttribute("datetime", value);
        }

        const on = isLive(clock, nowT);
        const offset = on ? null : offsetText(clock.t - nowT);

        live.classList.toggle("orrery__live--on", on);
        live.classList.toggle("orrery__live--bare", !on && offset === null);
        if (offset) {
            setText(liveFull, offset.full);
            setText(liveShort, offset.short);
            setText(liveWord, offset.word);
        }
        // Hiding the button would drop focus to <body>.
        if (on && document.activeElement === goLiveButton) date.focus();
        goLiveButton.hidden = on;
    };

    const show = () => {
        showRun();
        showRate();
        showTime();
    };

    const openRateMenu = () => {
        rateMenu.hidden = false;
        rateButton.setAttribute("aria-expanded", "true");
        rateItems[presetOf(clock.rate)]?.focus();
    };
    const closeRateMenu = (refocus: boolean) => {
        if (rateMenu.hidden) return;

        rateMenu.hidden = true;
        rateButton.setAttribute("aria-expanded", "false");
        if (refocus) rateButton.focus();
    };

    RATES.forEach((preset, k) => {
        rateItems[k]?.addEventListener("click", () => {
            const next = clock.rate < 0 ? -preset : preset;
            if (next !== clock.rate) cue("rate");
            world.setClock({ rate: next });
            closeRateMenu(true);
        });
    });
    reverseItem.addEventListener("click", () => {
        cue("rate");
        world.setClock({ rate: -clock.rate });
    });
    rateButton.addEventListener("click", () => {
        if (rateMenu.hidden) openRateMenu();
        else closeRateMenu(true);
    });
    rateButton.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !rateMenu.hidden) {
            // Otherwise the shortcut clears the selection and the menu stays.
            event.preventDefault();
            event.stopPropagation();
            closeRateMenu(true);
            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        if (rateMenu.hidden) openRateMenu();
        else menuItems[0]?.focus();
    });
    rateMenu.addEventListener("keydown", (event) => {
        const last = menuItems.length - 1;
        const k =
            event.target instanceof HTMLButtonElement
                ? menuItems.indexOf(event.target)
                : -1;
        const to = {
            ArrowDown: k === last ? 0 : k + 1,
            ArrowUp: k <= 0 ? last : k - 1,
            Home: 0,
            End: last,
        }[event.key];

        if (to !== undefined) {
            event.preventDefault();
            menuItems[to]?.focus();
        } else if (event.key === "Escape") {
            event.preventDefault();
            closeRateMenu(true);
        } else if (event.key === "Tab") {
            closeRateMenu(true);
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
            target.closest(".orrery__rate-menu, .orrery__rate")
        ) {
            return;
        }

        closeRateMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);

    run.addEventListener("click", () => {
        cue(clock.paused ? "play" : "pause");
        world.setClock({ paused: !clock.paused });
    });
    date.addEventListener("click", editor.toggle);
    goLiveButton.addEventListener("click", goLive);

    const off = world.on((event) => {
        if (event.type === "clock" || event.type === "scenario") show();
    });
    const interval = setInterval(showTime, REFRESH_MS);
    show();

    return {
        element,
        goLive,
        toggleDate: editor.toggle,
        destroy: () => {
            off();
            clearInterval(interval);
            document.removeEventListener("pointerdown", onPointerDown);
            editor.destroy();
            timeline.destroy();
            soundMenu.destroy();
            element.remove();
        },
    };
};
