import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { cue } from "../audio/cues.ts";
import { RATES } from "../clock.ts";
import { PART_NAMES, type PartName } from "../date-parts.ts";
import type { SavedStorage } from "../persistence.ts";
import { isLive, offsetText, rateText, stampParts } from "../time-text.ts";
import type { World } from "../world.ts";
import { createDateEditor } from "./date-editor.ts";
import { h, setText } from "./dom.ts";
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

// Rewind: two triangles pointing left.
const REVERSE_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M8 3v10L2 8zM14 3v10L8 8z"/></svg>';

/** The run, reverse and rate controls, Go live, and the timeline with the date over it. */
export const createTimeBar = (world: World, storage: SavedStorage): TimeBar => {
    const { clock } = world;

    const run = h("button", { type: "button", class: "orrery__run" });

    const reverse = h("button", {
        type: "button",
        class: "orrery__reverse",
        "aria-pressed": "false",
        "aria-keyshortcuts": "R",
        "aria-label": "Reverse",
        title: "Reverse the clock (R)",
    });
    reverse.innerHTML = REVERSE_ICON;

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

    // The fastest rate is at the top.
    const menuItems = rateItems.toReversed();
    const rateMenu = h(
        "div",
        {
            id: "orrery-rate-menu",
            class: "orrery__rate-menu",
            role: "menu",
            "aria-label": "Time warp",
        },
        ...menuItems,
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
    const liveChip = h(
        "span",
        { class: "orrery__date-live", "aria-hidden": "true" },
        "Live",
    );
    liveChip.hidden = true;
    const date = h(
        "button",
        {
            type: "button",
            class: "orrery__date",
            title: "Set the date (T)",
            "aria-expanded": "false",
            "aria-controls": "orrery-date-editor",
        },
        liveChip,
        // The name holds the visible date, so voice control can say what's shown.
        h("span", { class: "visually-hidden" }, "Set the date, "),
        time,
    );

    const liveFull = h("span", { class: "orrery__live-full" });
    const liveShort = h("span", { class: "orrery__live-short" });
    const liveWord = h("span", { class: "orrery__live-word" });
    const liveOffset = h("span", {}, " · ", liveFull, liveShort, " ", liveWord);
    const goLiveButton = h(
        "button",
        {
            type: "button",
            class: "orrery__go-live",
            "aria-keyshortcuts": "L",
            title: "Real time at 1 sec/s (L)",
        },
        "Go live",
        liveOffset,
    );
    // A status says Live once. The offset changes too often to announce.
    const liveStatus = h("span", {
        class: "visually-hidden",
        role: "status",
    });

    const editor = createDateEditor(world, date);
    const timeline = createTimeline(world, storage);

    const element = h(
        "div",
        { class: "orrery__clock", role: "group", "aria-label": "Time" },
        h(
            "div",
            { class: "orrery__transport" },
            run,
            h(
                "div",
                { class: "orrery__ratebox" },
                reverse,
                h("div", { class: "orrery__rate-wrap" }, rateButton, rateMenu),
            ),
            h("div", { class: "orrery__live-slot" }, goLiveButton, liveStatus),
        ),
        h(
            "div",
            { class: "orrery__stage" },
            timeline.element,
            date,
            editor.element,
        ),
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
        // The glyph is the action, as on a media player.
        run.innerHTML = iconSvg(clock.paused ? "play" : "pause");
    };

    const showRate = () => {
        const current = presetOf(clock.rate);

        element.classList.toggle("orrery__clock--reverse", clock.rate < 0);
        setText(rateLabel, rateText(clock.rate));
        rateItems.forEach((item, k) => {
            item.setAttribute("aria-checked", String(k === current));
        });
        reverse.setAttribute("aria-pressed", String(clock.rate < 0));
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

        liveChip.hidden = !on;
        setText(liveStatus, on ? "Live" : "");
        liveOffset.hidden = offset === null;
        if (offset) {
            setText(liveFull, offset.full);
            setText(liveShort, offset.short);
            setText(liveWord, offset.word);
        }
        const label = offset
            ? `Go live, the clock is ${offset.spoken} ${offset.word}`
            : "Go live";
        if (goLiveButton.getAttribute("aria-label") !== label) {
            goLiveButton.setAttribute("aria-label", label);
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
    reverse.addEventListener("click", () => {
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
            element.remove();
        },
    };
};
