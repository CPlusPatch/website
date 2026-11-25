<script lang="ts">
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import {
    isLive,
    offsetText,
    type PartName,
    presetOf,
    RATES,
    rateText,
    setText,
    stampParts,
} from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { flushSync, onMount, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { cue } from "../../audio/cues.ts";
import type { SavedStorage } from "../../persistence.ts";
import { getView } from "../../state/context.ts";
import { nowFlagLeft } from "../../timeline.ts";
import DateEditor from "./DateEditor.svelte";
import type { NowMark } from "./draw.ts";
import { menuTarget } from "./rate-menu.ts";
import Timeline from "./Timeline.svelte";

type Props = {
    storage: SavedStorage;
};

/** How often the shown time refreshes while the clock runs, in ms. */
const REFRESH_MS = 250;

// Rewind: two triangles pointing left.
const REVERSE_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M8 3v10L2 8zM14 3v10L8 8z"/></svg>';

// The fastest rate is at the top.
const MENU_ROWS = RATES.map((preset, k) => ({ preset, k })).toReversed();

/** The time as of the last refresh. */
type Shown = {
    stamp: ReturnType<typeof stampParts>;
    on: boolean;
    offset: ReturnType<typeof offsetText>;
};

const { storage }: Props = $props();

const view = getView();

const phone = matchMedia("(max-width: 720px)");

let element: HTMLElement | undefined;
let stage: HTMLElement | undefined;
let date = $state<HTMLButtonElement>();
let goLiveButton: HTMLButtonElement | undefined;
let goLiveText: HTMLElement | undefined;
let liveOffset: HTMLElement | undefined;
let rateButton: HTMLButtonElement | undefined;
const rateItems: (HTMLButtonElement | undefined)[] = $state([]);
let editor = $state.raw<ReturnType<typeof DateEditor>>();
let timeline = $state.raw<ReturnType<typeof Timeline>>();

let menuOpen = $state(false);

const readTime = (): Shown => {
    const nowT = unixMsToJ2000s(Date.now());
    const { paused, rate } = view.clock;
    const t = view.now();
    // A held clock changes nothing, so no part fades.
    const stamp = stampParts(t, paused ? 0 : rate);
    const on = isLive({ t, rate, paused }, nowT);

    return { stamp, on, offset: on ? null : offsetText(t - nowT) };
};

const first = readTime();
let shown = $state.raw(first);
const stampIso = $derived(
    `${shown.stamp.y.text}-${shown.stamp.mo.text}-${shown.stamp.d.text}T${shown.stamp.h.text}:${shown.stamp.mi.text}:${shown.stamp.s.text}Z`,
);

// Placing the Now flag: the Go live button's own attributes are set here, not in the template.
let isOn = first.on;
let offsetNow = first.offset;
let nowMark: (NowMark & { width: number }) | null = null;

// The flag's width and the tag's are read once, and again when they may have changed.
let measured = false;
let flagWidth = 0;
let tagHalf = 0;

const setFlag = (flag: boolean) => {
    if (!goLiveButton || !goLiveText || !liveOffset) return;

    goLiveButton.classList.toggle("orrery__go-live--flag", flag);
    setText(goLiveText, flag ? "Now" : "Go live");
    liveOffset.hidden = flag || offsetNow === null;
};

// The clash test needs the flag's width even while the button shows as the slot's text.
const measure = () => {
    if (!goLiveButton || !date) return;

    setFlag(true);
    flagWidth = goLiveButton.offsetWidth;
    tagHalf = date.offsetWidth / 2;
    // Zero means the bar isn't laid out yet, so measure again next time.
    measured = flagWidth > 0;
};

// With Now in the window and clear of the tag, Go live becomes the Now flag on the Now line.
const placeFlag = () => {
    if (!goLiveButton || !stage) return;

    let left: number | null = null;
    if (!isOn && nowMark?.inWindow) {
        if (!measured) measure();

        left = nowFlagLeft(
            nowMark.x,
            flagWidth,
            nowMark.width,
            tagHalf,
            phone.matches ? 8 : 6,
        );
    }
    const flag = left !== null;

    setFlag(flag);
    // The name is the visible text, for voice control. The long form goes in the description.
    const offset =
        offsetNow &&
        `${phone.matches ? offsetNow.short : offsetNow.full} ${offsetNow.word}`;
    const label = flag
        ? "Now, go live"
        : offset
          ? `Go live, ${offset}`
          : "Go live";
    const description = offsetNow
        ? `The clock is ${offsetNow.spoken} ${offsetNow.word}`
        : "";
    if (goLiveButton.getAttribute("aria-label") !== label) {
        goLiveButton.setAttribute("aria-label", label);
    }
    if ((goLiveButton.getAttribute("aria-description") ?? "") !== description) {
        if (description) {
            goLiveButton.setAttribute("aria-description", description);
        } else goLiveButton.removeAttribute("aria-description");
    }
    if (left === null) {
        goLiveButton.style.left = "";

        return;
    }

    const px = `${Math.round(left + stage.offsetLeft + stage.clientLeft)}px`;
    if (goLiveButton.style.left !== px) goLiveButton.style.left = px;
};

const showTime = () => {
    shown = readTime();
    offsetNow = shown.offset;
    isOn = shown.on;
    // Hiding the button would drop focus to <body>.
    if (isOn && document.activeElement === goLiveButton) date?.focus();
    placeFlag();
};

const remeasure = () => {
    measured = false;
    placeFlag();
};

/** Sets the clock to the real time at 1 sec/s, running. */
export const goLive = () => {
    view.setClock({
        t: unixMsToJ2000s(Date.now()),
        rate: 1,
        paused: false,
    });
};

/** Opens the date editor, or closes it if it's open. */
export const toggleDate = () => editor?.toggle();

const openRateMenu = () => {
    // A hidden item can't take focus.
    flushSync(() => {
        menuOpen = true;
    });
    rateItems[presetOf(view.clock.rate)]?.focus();
};

const closeRateMenu = (refocus: boolean) => {
    if (!menuOpen) return;

    menuOpen = false;
    if (refocus) rateButton?.focus();
};

const pickRate = (preset: number) => {
    const next = view.clock.rate < 0 ? -preset : preset;
    if (next !== view.clock.rate) cue("rate");
    view.setClock({ rate: next });
    closeRateMenu(true);
};

const menuItems = () => rateItems.toReversed();

// Native listeners, as the shortcuts handler on the document would see a delegated one too late.
const rateButtonKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key === "Escape" && menuOpen) {
            // Otherwise the shortcut clears the selection and the menu stays.
            event.preventDefault();
            event.stopPropagation();
            closeRateMenu(true);

            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        if (menuOpen) menuItems()[0]?.focus();
        else openRateMenu();
    });

const rateMenuKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        const items = menuItems();
        const k =
            event.target instanceof HTMLButtonElement
                ? items.indexOf(event.target)
                : -1;
        const to = menuTarget(event.key, k, items.length);

        if (to !== undefined) {
            event.preventDefault();
            items[to]?.focus();
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

const reverse = () => {
    cue("rate");
    view.setClock({ rate: -view.clock.rate });
};

const toggleRun = () => {
    cue(view.clock.paused ? "play" : "pause");
    view.setClock({ paused: !view.clock.paused });
};

// Every clock change shows at once, and a running clock refreshes on a timer.
$effect(() => {
    void view.clock.sets;

    untrack(showTime);
});

onMount(() => {
    const offs = [
        on(document, "pointerdown", (event) => {
            const target = event.target;
            if (
                target instanceof Element &&
                target.closest(".orrery__rate-menu, .orrery__rate")
            ) {
                return;
            }

            closeRateMenu(false);
        }),
        on(phone, "change", remeasure),
    ];
    const interval = setInterval(showTime, REFRESH_MS);
    // The tag's width changes with the Live chip and the phone layout.
    const resize = new ResizeObserver(remeasure);
    if (date) resize.observe(date);
    if (stage) resize.observe(stage);
    void document.fonts.ready.then(() => {
        if (element?.isConnected) remeasure();
    });

    return () => {
        for (const off of offs) off();
        clearInterval(interval);
        resize.disconnect();
    };
});
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: A <fieldset> would change the DOM and its styles. -->
<div
    class="orrery__clock"
    class:orrery__clock--reverse={view.clock.rate < 0}
    role="group"
    aria-label="Time"
    bind:this={element}
>
    <div class="orrery__transport">
        <button
            type="button"
            class="orrery__run"
            class:orrery__run--held={view.clock.paused}
            aria-label={view.clock.paused
                ? "Held. Run time"
                : "Running. Hold time"}
            onclick={toggleRun}
        >
            <!-- The glyph is the action, as on a media player. -->
            {@html iconSvg(view.clock.paused ? "play" : "pause")}
        </button>
        <div class="orrery__ratebox">
            <button
                type="button"
                class="orrery__reverse"
                aria-pressed={view.clock.rate < 0}
                aria-keyshortcuts="R"
                aria-label="Reverse"
                title="Reverse the clock (R)"
                onclick={reverse}
            >
                {@html REVERSE_ICON}
            </button>
            <div class="orrery__rate-wrap">
                <button
                    type="button"
                    class="orrery__rate"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls="orrery-rate-menu"
                    bind:this={rateButton}
                    onclick={() =>
                        menuOpen ? closeRateMenu(true) : openRateMenu()}
                    {@attach rateButtonKeys}
                >
                    <span class="orrery__rate-label"
                        >{rateText(view.clock.rate)}</span
                    >{@html iconSvg("chevron-down")}
                </button>
                <div
                    id="orrery-rate-menu"
                    class="orrery__rate-menu"
                    role="menu"
                    aria-label="Time warp"
                    hidden={!menuOpen}
                    {@attach rateMenuKeys}
                >
                    {#each MENU_ROWS as { preset, k } (k)}
                        <button
                            type="button"
                            class="orrery__rate-item"
                            role="menuitemradio"
                            tabindex="-1"
                            aria-checked={k === presetOf(view.clock.rate)}
                            bind:this={rateItems[k]}
                            onclick={() => pickRate(preset)}
                        >
                            {@html iconSvg("check")}
                            <span>{rateText(preset)}</span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
        <div class="orrery__live-slot">
            <button
                type="button"
                class="orrery__go-live"
                aria-keyshortcuts="L"
                title="Real time at 1 sec/s (L)"
                hidden={shown.on}
                bind:this={goLiveButton}
                onclick={goLive}
            >
                <span bind:this={goLiveText}>Go live</span
                ><span bind:this={liveOffset} hidden
                    >{" · "}<span class="orrery__live-full"
                        >{shown.offset?.full}</span
                    ><span class="orrery__live-short"
                        >{shown.offset?.short}</span
                    >{" "}<span class="orrery__live-word"
                        >{shown.offset?.word}</span
                    ></span
                >
            </button>
            <!-- A status says Live once. The offset changes too often to announce. -->
            <span class="visually-hidden" role="status"
                >{shown.on ? "Live" : ""}</span
            >
        </div>
    </div>
    <div class="orrery__stage" bind:this={stage}>
        <Timeline
            bind:this={timeline}
            {storage}
            {phone}
            onNow={(mark) => {
                nowMark = mark;
                placeFlag();
            }}
        />
        <button
            type="button"
            class="orrery__date"
            title="Set the date (T)"
            aria-expanded="false"
            aria-controls="orrery-date-editor"
            bind:this={date}
            onclick={() => editor?.toggle()}
            {@attach (node) => timeline?.grab(node)}
        >
            <span
                class="orrery__date-live"
                aria-hidden="true"
                hidden={!shown.on}
                >Live</span
            >
            <!-- The name holds the visible date, so voice control can say what's shown. -->
            <span class="visually-hidden">{"Set the date, "}</span>
            <!-- biome-ignore format: Whitespace inside the time is rendered. -->
            <time datetime={stampIso}>{@render part("y")}-{@render part("mo")}-{@render part("d")}<span class="orrery__tod">{" "}{@render part("h")}:{@render part("mi")}<span class="orrery__secs">:{@render part("s")}</span><span class="orrery__utc">{" UTC"}</span></span></time>
        </button>
        <DateEditor bind:this={editor} opener={date} />
    </div>
</div>

<!-- biome-ignore format: Whitespace inside the snippet is rendered. -->
{#snippet part(
    name: PartName,
)}<span class="orrery__date-digits" class:orrery__fast={shown.stamp[name].fast} data-part={name}>{shown.stamp[name].text}</span>{/snippet}
