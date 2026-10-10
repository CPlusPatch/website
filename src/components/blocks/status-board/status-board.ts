import { playWhileVisible } from "../../ui/pause-button.ts";
import {
    beatState,
    beatsOf,
    describe,
    isStale,
    type State,
    type StatusFeed,
    stateOf,
    summarise,
} from "./feed.ts";

/** Swaps an element's `tone-*` class for another. */
const setTone = (el: Element | null | undefined, tone: State) => {
    if (!el) return;
    for (const name of [...el.classList]) {
        if (name.startsWith("tone-")) el.classList.remove(name);
    }
    el.classList.add(`tone-${tone}`);
};

const setText = (el: Element | null | undefined, text: string) => {
    if (el) el.textContent = text;
};

/** Sets a <Status>'s label and light, as `statusTone` renders one. */
const setStatus = (status: Element | null, text: string, tone: State) => {
    const light = status?.querySelector(".status__light");
    setTone(light, tone);
    light?.classList.toggle("status__light--toned", tone !== "neutral");
    setText(status?.querySelector("[data-status-text]"), text);
};

/**
 * Shows the status feed at `data-src` on a <StatusBoard>: once now, then
 * every `data-interval` milliseconds while it is in view and not paused. If
 * the feed can't be loaded or is out of date, the board says so and keeps
 * the last results it had.
 */
export const bindStatusBoard = (root: HTMLElement) => {
    const src = root.dataset.src;
    if (!src) return;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-probe]")];
    const names = rows.map((row) => row.dataset.probe ?? "");
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });
    let shown: number | undefined;

    /** The headline, which the whole board takes its tone from. */
    const setHeadline = (text: string, tone: State) => {
        setTone(root, tone);
        setStatus(root.querySelector("[data-headline]"), text, tone);
    };

    const showRow = (row: HTMLElement, feed: StatusFeed, newer: boolean) => {
        const name = row.dataset.probe ?? "";
        const timeline = row.querySelector<HTMLElement>("[data-beats]");
        if (!timeline?.firstElementChild) return;
        // The oldest beat moves to the end, so the newest comes in animated. A
        // copy rather than a new element keeps the scoped styles' attribute
        if (newer) {
            timeline.append(timeline.firstElementChild.cloneNode());
            timeline.firstElementChild.remove();
        }
        const beats = beatsOf(feed, name, timeline.children.length);
        [...timeline.children].forEach((el, i) => {
            const state = beatState(beats[i]);
            if (state) el.setAttribute("data-state", state);
            else el.removeAttribute("data-state");
        });
        timeline.setAttribute("aria-label", describe(beats));

        const { latency, label, tone } = stateOf(feed, name);
        setText(row.querySelector("[data-latency]"), latency);
        setStatus(row.querySelector("[data-probe-status]"), label, tone);
    };

    const show = (feed: StatusFeed) => {
        const newer = shown !== undefined && feed.generatedAt > shown;
        shown = feed.generatedAt;
        for (const row of rows) showRow(row, feed, newer);

        const { tiles, headline, tone } = summarise(feed, names);
        for (const [key, tile] of Object.entries(tiles)) {
            const el = root.querySelector(`[data-tile="${key}"]`);
            setTone(el, tile.tone);
            setText(el?.querySelector("dd"), tile.value);
        }
        setHeadline(headline, tone);
        setText(
            root.querySelector("[data-updated]"),
            ` · updated ${time.format(feed.generatedAt * 1000)}`,
        );
    };

    const load = async () => {
        try {
            const response = await fetch(src, { cache: "no-cache" });
            if (!response.ok) throw new Error(`${response.status}`);
            const feed: StatusFeed = await response.json();
            show(feed);
            if (isStale(feed)) setHeadline("Status out of date", "neutral");
        } catch {
            setHeadline("Status unavailable", "neutral");
        }
    };

    load();
    playWhileVisible(
        root,
        root.querySelector("[data-status-live]"),
        Number(root.dataset.interval),
        load,
        // Only the newest beat moves, and not under reduced motion
        { pauseForReducedMotion: false },
    );
};
