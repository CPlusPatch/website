import { setProgress } from "../../../lib/progress.ts";
import { gatherLines, type Line } from "./visitor.ts";

/** Where the beat drops in the video, in seconds: the first line comes in. */
const DROP = 13.166;
/** Seconds between lines. */
const BEAT = 0.5;

/** How many lines are due at `time` into the video. */
const dueAt = (time: number) =>
    time < DROP ? 0 : Math.floor((time - DROP) / BEAT) + 1;

/**
 * Downloads `url` whole, reporting the fraction done as it goes, or null
 * throughout if the server doesn't say how big it is.
 */
const download = async (
    url: string,
    signal: AbortSignal,
    onProgress: (fraction: number | null) => void,
) => {
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) throw new Error(`${response.status}`);
    // Compressed responses report the compressed size, which the bytes read won't match
    const size =
        response.headers.get("Content-Encoding") === null
            ? Number(response.headers.get("Content-Length"))
            : 0;
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let loaded = 0;
    const reader = response.body.getReader();
    onProgress(size ? 0 : null);
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        if (size) onProgress(Math.min(1, loaded / size));
    }
    return new Blob(chunks, {
        type: response.headers.get("Content-Type") ?? "video/mp4",
    });
};

/**
 * Shrinks `text` until it fits in `box`'s height: as lines come in, and
 * whenever the window changes size.
 */
const fitHeight = (box: HTMLElement, text: HTMLElement) => {
    const fit = () => {
        text.style.fontSize = "";
        // Lines can wrap differently once smaller, so a few passes
        for (let pass = 0; pass < 4; pass++) {
            const ratio = box.clientHeight / text.scrollHeight;
            if (ratio >= 1) break;
            const size = Number.parseFloat(getComputedStyle(text).fontSize);
            text.style.fontSize = `${size * ratio * 0.98}px`;
        }
    };
    new ResizeObserver(fit).observe(box);
    return fit;
};

/**
 * Runs the /jammin page: downloads the video whole and gathers what's known
 * about the visitor, then waits for a click to play it, the visitor's
 * details coming in over it in time with the music from the drop on.
 */
export const bindJammin = (root: HTMLElement) => {
    const src = root.dataset.src;
    const card = root.querySelector<HTMLElement>("[data-jammin-card]");
    const status = root.querySelector<HTMLElement>("[data-jammin-status]");
    const bar = root.querySelector<HTMLElement>("[data-jammin-progress]");
    const start = root.querySelector<HTMLButtonElement>("[data-jammin-start]");
    const stage = root.querySelector<HTMLElement>("[data-jammin-stage]");
    const overlay = stage?.querySelector<HTMLElement>(".jammin__overlay");
    const video = root.querySelector<HTMLVideoElement>("video");
    const list = root.querySelector<HTMLElement>("[data-jammin-lines]");
    if (
        !src ||
        !card ||
        !status ||
        !bar ||
        !start ||
        !stage ||
        !overlay ||
        !video ||
        !list
    )
        return;

    const aborter = new AbortController();
    const { signal } = aborter;
    let blobUrl: string | undefined;
    let frame = 0;
    let lines: Line[] = [];
    const fit = fitHeight(overlay, list);

    const setStatus = (text: string) => {
        status.textContent = text;
    };

    /** Adds the lines due by now, and the rest once the video's over. */
    const reveal = () => {
        const due = video.ended
            ? lines.length
            : Math.min(lines.length, dueAt(video.currentTime));
        if (due > list.childElementCount) {
            if (!list.childElementCount)
                document.title = "You just got jammed!";
            for (const { label, value } of lines.slice(
                list.childElementCount,
                due,
            )) {
                const line = document.createElement("li");
                line.textContent = `${label}: ${value}`;
                list.append(line);
            }
            fit();
        }
    };

    /** Follows the video's position, not the clock, so stalls stay in step. */
    const tick = () => {
        reveal();
        frame =
            list.childElementCount < lines.length
                ? requestAnimationFrame(tick)
                : 0;
    };

    const prepare = async () => {
        card.hidden = false;
        try {
            const blob = await download(src, signal, (fraction) => {
                bar.classList.toggle(
                    "jammin__progress--indeterminate",
                    fraction === null,
                );
                if (fraction === null) {
                    bar.removeAttribute("aria-valuenow");
                    setStatus("Downloading the video...");
                } else {
                    setProgress(bar, fraction * 100);
                    setStatus(
                        `Downloading the video... ${Math.round(fraction * 100)}%`,
                    );
                }
            });
            blobUrl = URL.createObjectURL(blob);
            video.src = blobUrl;
        } catch {
            if (!signal.aborted) {
                setStatus(
                    "The video couldn't be downloaded. Try reloading the page.",
                );
                bar.hidden = true;
            }
            return;
        }

        bar.hidden = true;
        setStatus("Fetching...");
        lines = await gatherLines(signal);
        if (signal.aborted) return;

        card.hidden = true;
        start.hidden = false;
        start.focus();
    };

    start.addEventListener("click", () => {
        start.hidden = true;
        stage.hidden = false;
        // Within the click, so it may play with sound
        video.play().catch(() => {
            // Not allowed after all, so the button gets another go
            stage.hidden = true;
            start.hidden = false;
        });
        frame = requestAnimationFrame(tick);
    });

    video.addEventListener("ended", () => {
        video.hidden = true;
        reveal();
    });

    // Leaving mid-sequence: stop everything and let go of the video
    addEventListener("pagehide", () => {
        aborter.abort();
        cancelAnimationFrame(frame);
        video.pause();
        video.removeAttribute("src");
        video.load();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    });
    // Back from the back/forward cache, with nothing left to play
    addEventListener("pageshow", (event) => {
        if (event.persisted) location.reload();
    });

    // Narrow screens get a message instead, and nothing is fetched until wide
    const wide = matchMedia(root.dataset.minWidth ?? "all");
    if (wide.matches) void prepare();
    else
        wide.addEventListener("change", () => void prepare(), {
            once: true,
            signal,
        });
};
