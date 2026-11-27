<script lang="ts">
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { isLive, offsetText, setText, stampParts } from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import { onMount, untrack } from "svelte";
import { on } from "svelte/events";
import { cue } from "../../audio/cues.ts";
import type { SavedStorage } from "../../persistence.ts";
import { getView } from "../../state/context.ts";
import { nowFlagLeft } from "../../timeline.ts";
import DateButton from "./DateButton.svelte";
import DateEditor from "./DateEditor.svelte";
import type { NowMark } from "./draw.ts";
import { goLiveName } from "./go-live.ts";
import RateMenu from "./RateMenu.svelte";
import Timeline from "./Timeline.svelte";

type Props = {
    storage: SavedStorage;
};

/** How often the shown time refreshes while the clock runs, in ms. */
const REFRESH_MS = 250;

// Rewind: two triangles pointing left.
const REVERSE_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M8 3v10L2 8zM14 3v10L8 8z"/></svg>';

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
let editor = $state.raw<ReturnType<typeof DateEditor>>();
let timeline = $state.raw<ReturnType<typeof Timeline>>();

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
    const { label, description } = goLiveName(flag, offsetNow, phone.matches);
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
    const offPhone = on(phone, "change", remeasure);
    const interval = setInterval(showTime, REFRESH_MS);
    // The tag's width changes with the Live chip and the phone layout.
    const resize = new ResizeObserver(remeasure);
    if (date) resize.observe(date);
    if (stage) resize.observe(stage);
    void document.fonts.ready.then(() => {
        if (element?.isConnected) remeasure();
    });

    return () => {
        offPhone();
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
            <RateMenu />
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
        <DateButton
            stamp={shown.stamp}
            on={shown.on}
            bind:button={date}
            onclick={() => editor?.toggle()}
            grab={(node) => timeline?.grab(node)}
        />
        <DateEditor bind:this={editor} opener={date} />
    </div>
</div>

<style>
.orrery__clock {
    /* The height of the buttons and the menu items in the bar. */
    --orrery-clock-control: var(--orrery-control-lg);

    position: relative;
    box-sizing: border-box;
    flex: 1 1 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    block-size: 64px;
    border-block-start: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel);
    backdrop-filter: blur(6px);
}

.orrery__transport {
    display: flex;
    align-items: center;
    gap: 8px;
    min-inline-size: 0;
    padding: 0 var(--orrery-pad);
}

.orrery__run,
.orrery__reverse {
    box-sizing: border-box;
    block-size: var(--orrery-clock-control);
    border: 1px solid var(--orrery-control-frame);
    border-radius: 0;
    background-color: var(--orrery-panel-raised);
    color: var(--orrery-text);
    cursor: pointer;

    /* Over the neighbour whose border it overlaps. */
    &:focus-visible {
        position: relative;
        z-index: 3;
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    @media (hover: hover) {
        &:hover:not(.orrery__run--held, [aria-pressed="true"]) {
            background-color: var(--orrery-panel-hover);
        }
    }
}

.orrery__run,
.orrery__reverse {
    display: grid;
    place-items: center;
    inline-size: var(--orrery-clock-control);
    padding: 0;
}

.orrery__run {
    color: var(--orrery-go);

    /* The stroked icons read as outlines at this size. */
    :global(svg) {
        inline-size: 14px;
        block-size: 14px;
    }

    :global(svg *) {
        fill: currentColor;
    }

    /* The orange frame and glyph mark the held state. */
    &.orrery__run--held {
        border-color: var(--orrery-hold);
        background-color: var(--orrery-panel-solid);
        color: var(--orrery-hold);
    }
}

.orrery__reverse {
    :global(svg) {
        inline-size: 16px;
        block-size: 16px;
    }

    /* A fill as well as the colour, so the state doesn't rest on hue. */
    &[aria-pressed="true"] {
        border-color: var(--orrery-hold);
        background-color: var(--orrery-hold);
        color: var(--orrery-ground);
    }
}

/* Reverse and the rate button, joined. */
.orrery__ratebox {
    display: flex;
}

.orrery__stage {
    position: relative;
    min-inline-size: 0;
    border-inline-start: 1px solid var(--orrery-frame);
    background-color: var(--orrery-ground);
}

/* A fixed slot, so the bar doesn't shift when Go live hides. */
.orrery__live-slot {
    flex: none;
    display: flex;
    align-items: center;
    inline-size: 11rem;
    min-inline-size: 0;
}

/* The longest text, "Go live · 26y 327d behind", is about 147px wide. */
@media (width < 1000px) {
    .orrery__live-slot {
        inline-size: 9.75rem;
    }
}

.orrery__go-live {
    min-inline-size: 0;
    block-size: var(--orrery-clock-control);
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--orrery-go);
    font: 600 var(--orrery-size-sm) / 1 var(--orrery-font-ui);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    cursor: pointer;

    &[hidden] {
        display: none;
    }

    &:focus-visible {
        outline: 2px solid var(--orrery-text);
        outline-offset: -2px;
    }

    @media (hover: hover) {
        &:hover {
            text-decoration: underline;
            text-underline-offset: 3px;
        }
    }
}

/* The Now flag: the button over the Now line, placed in px by the time bar. */
.orrery__go-live:global(.orrery__go-live--flag) {
    position: absolute;
    z-index: 2;
    inset-block-start: 2px;
    block-size: 20px;
    padding: 0 0.375rem;
    background-color: var(--orrery-ground);
    font: 600 var(--orrery-size-label) / 1 var(--orrery-font-ui);
    overflow: visible;
    text-overflow: clip;

    /* Clear of the bar's top border. */
    &:focus-visible {
        outline-offset: 0;
    }
}

.orrery__live-short {
    display: none;
}

@media (max-width: 720px) {
    /* The timeline on top, then a row of controls. */
    .orrery__clock {
        --orrery-clock-control: var(--control-height-md);

        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) var(--control-height-md);
        block-size: calc(108px + env(safe-area-inset-bottom, 0px));
        padding-block-end: env(safe-area-inset-bottom, 0px);
    }

    .orrery__stage {
        grid-row: 1;
        border-inline-start: 0;
        border-block-end: 1px solid var(--orrery-rule);
    }

    .orrery__transport {
        grid-row: 2;
        padding: 0 var(--orrery-inset);
    }

    .orrery__live-slot {
        flex: 1;
        inline-size: auto;
    }

    .orrery__live-full {
        display: none;
    }

    .orrery__live-short {
        display: inline;
    }

    .orrery__go-live:global(.orrery__go-live--flag) {
        block-size: 18px;
        padding: 0 0.25rem;

        &::after {
            content: "";
            position: absolute;
            inset: -3px -4px -25px;
        }
    }
}

@media (forced-colors: active) {
    .orrery__clock {
        border-block-start-color: CanvasText;
    }

    .orrery__stage {
        border-color: CanvasText;
    }

    .orrery__run,
    .orrery__reverse {
        border-color: ButtonText;
    }

    .orrery__reverse[aria-pressed="true"] {
        border-color: Highlight;
        background-color: Highlight;
        color: HighlightText;
    }

    .orrery__go-live:global(.orrery__go-live--flag) {
        border: 1px solid ButtonText;
    }
}
</style>
