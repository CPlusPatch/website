#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/// <reference types="deno" />
/**
 * Usage: cli.ts <video file or URL> --out <dir> [options]
 *
 * Turns a video into a flipbook: each frame scaled down to a coarse grid,
 * and its brightness split into a few levels. Also keeps its soundtrack. A
 * URL is downloaded with yt-dlp first; ffmpeg does the rest, so both need
 * to be installed.
 *
 *   --columns <n>   grid width (default 40)
 *   --rows <n>      grid height (default 30)
 *   --fps <n>       frames per second (default 15)
 *   --levels <n>    shades, from 2 for black and white (default 2)
 *   --fit <mode>    contain: the whole picture, centred between empty
 *                   cells; cover: fill the grid, cropping the picture
 *                   (default contain)
 *   --invert        dark, rather than bright, becomes the high levels
 *   --no-audio      skip the soundtrack
 *
 * Writes <dir>/frames.bin, the flipbook, and <dir>/audio.ogg, the
 * soundtrack as Opus.
 */

import { encode } from "./codec.ts";

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
const fps = number("fps", 15);
const levels = number("levels", 2);
const fit = option("fit") ?? "contain";
const invert = args.includes("--invert");
const audio = !args.includes("--no-audio");
const source = args.find((arg) => !arg.startsWith("--"));
if (!out || !source || (fit !== "contain" && fit !== "cover")) {
    console.error(usage);
    Deno.exit(2);
}

const run = async (command: string, commandArgs: string[]) => {
    const result = await new Deno.Command(command, {
        args: commandArgs,
        stdout: "piped",
        stderr: "inherit",
    }).output();
    if (!result.success) {
        console.error(`${command} failed.`);
        Deno.exit(1);
    }
    return result.stdout;
};

/** A local copy of the video, and a way to clean up after it. */
const fetchVideo = async (): Promise<[path: string, done: () => void]> => {
    if (!/^https?:\/\//.test(source)) return [source, () => {}];
    const dir = await Deno.makeTempDir();
    console.log(`Downloading ${source}`);
    // Small, with sound: it is about to become a few dozen cells wide.
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

// Level 0 is the empty cell, so the picture is padded in its colour.
const empty = invert ? "white" : "black";
const size = `${columns}:${rows}`;
const sizing =
    fit === "contain"
        ? `scale=${size}:force_original_aspect_ratio=decrease:flags=area,pad=${size}:(ow-iw)/2:(oh-ih)/2:color=${empty}`
        : `scale=${size}:force_original_aspect_ratio=increase:flags=area,crop=${size}`;
console.log(`Converting to ${columns} × ${rows} at ${fps} fps`);
const raw = await run("ffmpeg", [
    "-loglevel",
    "error",
    "-i",
    video,
    "-vf",
    `fps=${fps},${sizing},format=gray`,
    "-f",
    "rawvideo",
    "-",
]);
if (audio) {
    console.log("Extracting the soundtrack");
    await run("ffmpeg", [
        "-loglevel",
        "error",
        "-y",
        "-i",
        video,
        "-vn",
        "-c:a",
        "libopus",
        "-b:a",
        "48k",
        `${out}/audio.ogg`,
    ]);
}
done();

const cells = columns * rows;
const frames = Array.from({ length: Math.floor(raw.length / cells) }, (_, f) =>
    raw.subarray(f * cells, (f + 1) * cells).map((gray) => {
        const level = Math.round((gray / 255) * (levels - 1));
        return invert ? levels - 1 - level : level;
    }),
);

const bytes = encode({ columns, rows, fps, levels, frames });
await Deno.writeFile(`${out}/frames.bin`, bytes);
console.log(
    `Wrote ${frames.length} frames (${(bytes.length / 1024).toFixed(0)} KB) to ${out}`,
);
