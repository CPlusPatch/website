/**
 * Films the Orrery shot by shot from `shots.ts` into `.video/`, on a fake clock: every frame is
 * 1/60 s of app time however long it takes to capture.
 *
 * Needs `deno run preview --port 4322` on a fresh build. Flags:
 * - `--only <id>` films one shot.
 * - `--from <id>` films that shot and the ones after it.
 * - `--stills` also saves one PNG a second, under `.video/stills/<id>/`.
 * - `--cut-only` skips filming and joins the shots already filmed.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { type Browser, chromium, type Page } from "@playwright/test";
import { FPS, HEIGHT, WIDTH } from "./actions.ts";
import { MUSIC, MUSIC_START, SHOTS, type Shot, START } from "./shots.ts";

const URL = "http://localhost:4322/orbits/";
const OUT = ".video";

const flag = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
};

/** Runs ffmpeg, writing `input` to its stdin if given, and fails on a non-zero exit. */
const ffmpeg = (args: string[]) => {
    const child = spawn(
        "ffmpeg",
        ["-hide_banner", "-loglevel", "error", "-y", ...args],
        {
            stdio: ["pipe", "inherit", "inherit"],
        },
    );
    const done = new Promise<void>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`ffmpeg exited with ${code}`)),
        );
    });

    return { stdin: child.stdin, done };
};

/** Opens the page on the fake clock and waits, in real time, until it has loaded. */
const open = async (browser: Browser): Promise<Page> => {
    const context = await browser.newContext({
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    let pending = 0;

    page.on("request", () => pending++);
    page.on("requestfinished", () => pending--);
    page.on("requestfailed", () => pending--);

    await page.clock.install({ time: new Date(START.getTime() - 1000) });
    await page.clock.pauseAt(START);
    await page.goto(URL);

    // Assets arrive in real time, so step the fake clock slowly until the overlay has gone.
    while (
        (await page.locator(".orrery__loading").count()) > 0 ||
        pending > 0
    ) {
        await page.clock.runFor(1000 / FPS);
        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    await page.keyboard.press("l");
    // Keys after a drag give the canvas a focus ring, which means nothing with no cursor.
    await page.addStyleTag({
        content: ".orrery__canvas canvas { outline: none !important; }",
    });
    page.on("pageerror", (error) => {
        throw error;
    });

    return page;
};

/** Waits in real time for requests the setup started, like a body's maps. */
const idle = async (page: Page) => {
    const pending = new Set();
    page.on("request", (r) => pending.add(r));
    page.on("requestfinished", (r) => pending.delete(r));
    page.on("requestfailed", (r) => pending.delete(r));

    // Give lazy loads a few frames to start.
    for (let i = 0; i < 10 || pending.size > 0; i++) {
        await page.clock.runFor(1000 / FPS);
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
};

/**
 * Moves CSS animations and transitions to the fake clock's time. They run on real time, and a
 * frame takes far longer than 1/60 s to capture, so a fade would otherwise be over in a frame.
 */
const stepAnimations = (page: Page) =>
    page.evaluate(() => {
        const now = performance.now();
        const store = window as Window & {
            videoStarts?: WeakMap<Animation, number>;
        };
        store.videoStarts ??= new WeakMap();
        const starts = store.videoStarts;

        for (const animation of document.getAnimations()) {
            const start = starts.get(animation) ?? now;
            const end = Number(
                animation.effect?.getComputedTiming().endTime ?? 0,
            );
            starts.set(animation, start);

            if (now - start >= end) {
                animation.finish();
                continue;
            }
            animation.pause();
            animation.currentTime = now - start;
        }
    });

const film = async (browser: Browser, shot: Shot, stills: boolean) => {
    const page = await open(browser);
    await shot.setup(page);
    await idle(page);

    const cdp = await page.context().newCDPSession(page);
    const frames = Math.round(shot.seconds * FPS);
    const encoder = ffmpeg([
        ...[
            "-f",
            "image2pipe",
            "-framerate",
            `${FPS}`,
            "-c:v",
            "png",
            "-i",
            "-",
        ],
        ...[
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "12",
            "-pix_fmt",
            "yuv420p",
        ],
        `${OUT}/shots/${shot.id}.mp4`,
    ]);
    const running = shot.cues.map(([at, action]) => ({
        start: Math.round(at * FPS),
        action,
    }));

    // Cues before 0 run unfilmed, so a move is already under way at the cut.
    const first = Math.min(0, ...running.map(({ start }) => start));

    if (stills) await mkdir(`${OUT}/stills/${shot.id}`, { recursive: true });

    for (let frame = first; frame < frames; frame++) {
        for (const { start, action } of running) {
            const local = frame - start;
            if (local >= 0 && local < action.frames)
                await action.run(page, local);
        }

        await page.clock.runFor(1000 / FPS);
        await stepAnimations(page);
        if (frame < 0) continue;

        const { data } = await cdp.send("Page.captureScreenshot", {
            format: "png",
            optimizeForSpeed: true,
        });
        const png = Buffer.from(data, "base64");

        if (!encoder.stdin.write(png)) {
            await new Promise((resolve) =>
                encoder.stdin.once("drain", resolve),
            );
        }
        if (stills && frame % FPS === 0) {
            await writeFile(`${OUT}/stills/${shot.id}/${frame / FPS}.png`, png);
        }
    }

    encoder.stdin.end();
    await encoder.done;
    await page.context().close();
};

/** Joins the shots, fades in and out, and lays the music under them. */
const cut = async () => {
    const inputs = SHOTS.flatMap((shot) => [
        "-i",
        `${OUT}/shots/${shot.id}.mp4`,
    ]);
    // xfade needs both inputs on one timebase, and concat changes it.
    const joins = SHOTS.map((_, i) => `[${i}:v]settb=AVTB[s${i}]`);
    let seconds = SHOTS[0]?.seconds ?? 0;
    let joined = "[s0]";

    for (const [i, shot] of SHOTS.entries()) {
        if (i === 0) continue;

        const fade = shot.fade ?? 0;
        joins.push(
            fade > 0
                ? `${joined}[s${i}]xfade=transition=fade:duration=${fade}:offset=${seconds - fade}[j${i}]`
                : `${joined}[s${i}]concat=n=2:v=1:a=0[j${i}]`,
        );
        seconds += shot.seconds - fade;
        joined = `[j${i}]`;
    }

    const music = SHOTS.length;
    const filter = [
        ...joins,
        `${joined}fade=t=in:d=0.5,fade=t=out:st=${seconds - 1.5}:d=1.5[v]`,
        `[${music}:a]atrim=0:${seconds},afade=t=in:d=1,afade=t=out:st=${seconds - 3}:d=3[a]`,
    ].join(";");

    await ffmpeg([
        ...inputs,
        ...["-ss", `${MUSIC_START}`, "-i", MUSIC],
        ...["-filter_complex", filter, "-map", "[v]", "-map", "[a]"],
        ...[
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
        ],
        ...["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
        `${OUT}/orrery.mp4`,
    ]).done;
};

const only = flag("--only");
const from = flag("--from");
const fromIndex = from ? SHOTS.findIndex((shot) => shot.id === from) : 0;
const chosen = SHOTS.filter((shot, i) =>
    only ? shot.id === only : i >= fromIndex,
);

if ((only || from) && chosen.length === 0) {
    throw new Error(`No shot called ${only ?? from}`);
}

if (!process.argv.includes("--cut-only")) {
    await mkdir(`${OUT}/shots`, { recursive: true });
    const browser = await chromium.launch({
        args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=vulkan"],
    });

    for (const shot of chosen) {
        const started = performance.now();
        await film(browser, shot, process.argv.includes("--stills"));
        console.log(
            `${shot.id.padEnd(12)} ${((performance.now() - started) / 1000).toFixed(0)} s`,
        );
    }

    await browser.close();
}

if (!only) {
    await cut();
    console.log(`${OUT}/orrery.mp4`);
}
