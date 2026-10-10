#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/// <reference types="deno" />
/**
 * Usage: cli.ts <video file or URL> --out <dir> [options]
 *
 * Shrinks a video for the terminal's players: a picture only a few dozen
 * pixels across, in full colour, with its soundtrack inside as mono Opus.
 * The browser decodes and streams it, so it suits anything up to a whole
 * film. A URL is downloaded with yt-dlp first; ffmpeg does the rest, so both
 * need to be installed.
 *
 *   --columns <n>         width in pixels, even (default 40)
 *   --rows <n>            height in pixels, even (default 30)
 *   --fps <n>             frames per second (default: the video's own)
 *   --fit <mode>          contain: the whole picture, centred on black;
 *                         cover: fill the frame, cropping the picture
 *                         (default contain)
 *   --crf <n>             picture quality, lower is better (default 35)
 *   --audio-bitrate <n>   in kbps (default 16: clear speech, lo-fi music)
 *   --no-audio            skip the soundtrack
 *
 * Writes <dir>/video.webm.
 */

// A module, for top-level await, though it exports nothing.
export {};

const usage = "Usage: cli.ts <video file or URL> --out <dir> [options]";

const args = [...Deno.args];
const option = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? undefined : args.splice(index, 2)[1];
};
const number = (name: string, fallback: number) => {
    const value = Number(option(name) ?? fallback);
    if (!Number.isFinite(value) || value < 0) {
        console.error(`--${name} takes a number.`);
        Deno.exit(2);
    }
    return value;
};

const out = option("out");
const columns = number("columns", 40);
const rows = number("rows", 30);
const fps = number("fps", 0);
const crf = number("crf", 35);
const audioBitrate = number("audio-bitrate", 16);
const fit = option("fit") ?? "contain";
const audio = !args.includes("--no-audio");
const source = args.find((arg) => !arg.startsWith("--"));
if (!out || !source || (fit !== "contain" && fit !== "cover")) {
    console.error(usage);
    Deno.exit(2);
}
// VP9 keeps colour at half resolution, which needs even sides.
if (columns % 2 || rows % 2) {
    console.error("--columns and --rows need to be even.");
    Deno.exit(2);
}

const run = async (command: string, commandArgs: string[]) => {
    const result = await new Deno.Command(command, {
        args: commandArgs,
        stderr: "inherit",
    }).output();
    if (!result.success) {
        console.error(`${command} failed.`);
        Deno.exit(1);
    }
};

/** A local copy of the video, and a way to clean up after it. */
const fetchVideo = async (): Promise<[path: string, done: () => void]> => {
    if (!/^https?:\/\//.test(source)) return [source, () => {}];
    const dir = await Deno.makeTempDir();
    console.log(`Downloading ${source}`);
    // Small, with sound: it is about to become a few dozen pixels wide.
    await run("yt-dlp", [
        "--quiet",
        "--no-warnings",
        "--format",
        "b[height<=480]/bv*[height<=480]+ba/b",
        "--output",
        `${dir}/video.%(ext)s`,
        source,
    ]);
    const [file] = [...Deno.readDirSync(dir)];
    return [
        `${dir}/${file.name}`,
        () => Deno.removeSync(dir, { recursive: true }),
    ];
};

const [video, done] = await fetchVideo();
await Deno.mkdir(out, { recursive: true });

const size = `${columns}:${rows}`;
const sizing =
    fit === "contain"
        ? `scale=${size}:force_original_aspect_ratio=decrease:flags=area,pad=${size}:(ow-iw)/2:(oh-ih)/2:color=black`
        : `scale=${size}:force_original_aspect_ratio=increase:flags=area,crop=${size}`;
console.log(`Converting to ${columns} × ${rows}`);
await run("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    video,
    "-vf",
    fps ? `fps=${fps},${sizing}` : sizing,
    "-c:v",
    "libvpx-vp9",
    "-crf",
    String(crf),
    "-b:v",
    "0",
    "-deadline",
    "good",
    "-cpu-used",
    "4",
    "-row-mt",
    "1",
    ...(audio
        ? ["-ac", "1", "-c:a", "libopus", "-b:a", `${audioBitrate}k`]
        : ["-an"]),
    `${out}/video.webm`,
]);
done();

const { size: bytes } = await Deno.stat(`${out}/video.webm`);
console.log(`Wrote ${(bytes / 1024 / 1024).toFixed(1)} MB to ${out}`);
