import type { Program } from "./terminal.ts";

/**
 * Scales the picture down to the terminal's width, if it is wider, from now
 * on: a stopped video's last frame stays, and keeps fitting.
 */
const fitWidth = (output: HTMLElement) =>
    new ResizeObserver(() => {
        output.style.fontSize = "";
        const ratio = output.clientWidth / output.scrollWidth;
        if (ratio < 1) output.style.fontSize = `${ratio}em`;
    }).observe(output);

/**
 * Plays a video made by packages/flipbook in a terminal's output: a <video>
 * the size of the picture decodes and streams it, sound and all, and each
 * frame is copied onto a grid of ▀ characters, two pixels each, the top and
 * bottom colours drawn by CSS (see .terminal__pixel), so they are square
 * whatever the font. Nothing is fetched until it runs.
 */
export const playVideo =
    (url: string, title: string): Program =>
    (output, done) => {
        output.textContent = `Loading ${title}... (Ctrl+C to stop)`;
        const video = document.createElement("video");
        video.playsInline = true;
        // Its pixels are read back, which another site's video only allows
        // when that site sends CORS headers; without them, it won't load.
        video.crossOrigin = "anonymous";
        video.src = url;
        // Started now, while the keypress still counts as one for sound.
        video.play().catch(() => {
            video.muted = true;
            return video.play();
        });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const cells: HTMLElement[] = [];
        let shown: number[] = [];
        let raf = 0;
        let last = -1;
        const listening = new AbortController();
        const { signal } = listening;

        /** A ▀ for every two rows, a line per pair. */
        const build = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            output.replaceChildren();
            output.classList.add("terminal__screen");
            for (let y = 0; y < canvas.height; y += 2) {
                for (let x = 0; x < canvas.width; x++) {
                    const cell = document.createElement("span");
                    cell.className = "terminal__pixel";
                    cell.textContent = "▀";
                    output.append(cell);
                    cells.push(cell);
                }
                output.append("\n");
            }
            shown = new Array(cells.length * 2).fill(-1);
            fitWidth(output);
            const terminal = output.closest<HTMLElement>(".terminal");
            if (terminal) terminal.scrollTop = terminal.scrollHeight;
        };

        const draw = () => {
            if (!context) return;
            context.drawImage(video, 0, 0);
            const { data } = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            );
            const columns = canvas.width;
            for (const [i, cell] of cells.entries()) {
                const x = i % columns;
                const y = Math.floor(i / columns) * 2;
                for (const [half, row, name] of [
                    [0, y, "--top"],
                    [1, y + 1, "--bottom"],
                ] as const) {
                    const p = (row * columns + x) * 4;
                    const rgb =
                        (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
                    // Only what changed, which is most of a still shot.
                    if (shown[i * 2 + half] === rgb) continue;
                    shown[i * 2 + half] = rgb;
                    cell.style.setProperty(
                        name,
                        `rgb(${data[p]} ${data[p + 1]} ${data[p + 2]})`,
                    );
                }
            }
        };

        const frame = () => {
            if (video.currentTime !== last) {
                last = video.currentTime;
                draw();
            }
            raf = requestAnimationFrame(frame);
        };

        video.addEventListener(
            "playing",
            () => {
                build();
                frame();
            },
            { once: true, signal },
        );
        video.addEventListener(
            "ended",
            () => {
                stop();
                done();
            },
            { signal },
        );
        video.addEventListener(
            "error",
            () => {
                output.textContent = `Couldn't play ${title}.`;
                stop();
                done();
            },
            { signal },
        );

        const stop = () => {
            listening.abort();
            cancelAnimationFrame(raf);
            video.pause();
            // Stops the download too, not just the playback.
            video.removeAttribute("src");
            video.load();
        };
        return stop;
    };
