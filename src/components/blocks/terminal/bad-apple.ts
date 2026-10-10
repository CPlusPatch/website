import { decode, toText } from "@cpluspatch/flipbook";
import audioUrl from "../../../data/bad-apple/audio.ogg?url";
import framesUrl from "../../../data/bad-apple/frames.bin?url";
import type { Program } from "./terminal.ts";

/**
 * Plays Bad Apple!! in a terminal's output, as block characters, with its
 * music. The frames (made by `deno run frames`) and the music are only
 * fetched now, and the frames follow the music's clock, so the two stay in
 * step.
 */
export const badApple: Program = (output, done) => {
    output.textContent = "Loading Bad Apple!!... (Ctrl+C to stop)";
    const audio = new Audio(audioUrl);
    let stopped = false;
    let raf = 0;

    void (async () => {
        try {
            const response = await fetch(framesUrl);
            const book = decode(new Uint8Array(await response.arrayBuffer()));
            if (stopped) return;
            // Without sound (if the browser won't play it), keep time alone.
            const started = performance.now();
            await audio.play().catch(() => {});
            const time = () =>
                audio.paused
                    ? (performance.now() - started) / 1000
                    : audio.currentTime;

            output.classList.add("terminal__art");
            const frame = () => {
                if (stopped) return;
                const index = Math.floor(time() * book.fps);
                if (index >= book.frames.length) {
                    done();
                    return;
                }
                output.textContent = toText(book, book.frames[index]);
                raf = requestAnimationFrame(frame);
            };
            frame();
            // Scrolled to once, now that the picture has its full height.
            const terminal = output.closest<HTMLElement>(".terminal");
            if (terminal) terminal.scrollTop = terminal.scrollHeight;
        } catch (error) {
            output.textContent = "badapple: couldn't load the frames";
            console.error(error);
            done();
        }
    })();

    return () => {
        stopped = true;
        cancelAnimationFrame(raf);
        audio.pause();
    };
};
