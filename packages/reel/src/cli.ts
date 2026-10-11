#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/// <reference types="deno" />
/**
 * Usage: cli.ts <URL or list file>... --out <dir> [options]
 *
 * Downloads short videos for <Shorts>, in the order given: each one's
 * video, cut to 9:16 as H.264 with AAC sound, at no more than 30 frames
 * a second; its thumbnail, cut to match, for the poster; its title,
 * channel and likes; and the channel's avatar.
 * yt-dlp fetches and ffmpeg converts, so both need to be installed.
 *
 * A list file has one URL per line; blank lines and lines starting with #
 * are skipped. Videos already in <dir> are not downloaded again, so a list
 * can grow over time and be re-run.
 *
 *   --height <n>         frame height in pixels, even; the width is 9/16
 *                        of it (default 1024, for a
 *                        feed about 350 wide)
 *   --fit <mode>         cover: fill the frame, cropping a picture of
 *                        another shape; contain: the whole picture, on
 *                        black (default cover)
 *   --crf <n>            picture quality, lower is better (default 30)
 *   --max-duration <s>   skip anything longer (default 180, as YouTube)
 *
 * Writes, per video, <dir>/<id>.mp4 and <id>.jpg; each channel's avatar
 * as <dir>/avatars/<channel id>.jpg; and <dir>/manifest.json, which lists
 * the videos in order with their details, and is what the site reads.
 * Files of videos no longer listed are left alone.
 */

// A module, for top-level await, though it exports nothing.
export {};

const usage = "Usage: cli.ts <URL or list file>... --out <dir> [options]";

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
const height = number("height", 1024);
const crf = number("crf", 30);
const maxDuration = number("max-duration", 180);
const fit = option("fit") ?? "cover";
const sources = args.filter((arg) => !arg.startsWith("--"));
if (!out || !sources.length || (fit !== "contain" && fit !== "cover")) {
    console.error(usage);
    Deno.exit(2);
}
// H.264 keeps colour at half resolution, which needs even sides.
const width = Math.round((height * 9) / 16 / 2) * 2;
if (height % 2) {
    console.error("--height needs to be even.");
    Deno.exit(2);
}

/** URLs as given, with list files read in their place. */
const urls = sources.flatMap((source) =>
    /^https?:\/\//.test(source)
        ? [source]
        : Deno.readTextFileSync(source)
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith("#")),
);

/**
 * Runs a command, returning whether it worked. Its errors show as they
 * happen.
 */
const run = async (command: string, commandArgs: string[]) =>
    (
        await new Deno.Command(command, {
            args: commandArgs,
            stdout: "null",
            stderr: "inherit",
        }).output()
    ).success;

/** Runs a command, returning what it printed, or undefined if it failed. */
const capture = async (command: string, commandArgs: string[]) => {
    const result = await new Deno.Command(command, {
        args: commandArgs,
        stdout: "piped",
        stderr: "inherit",
    }).output();
    return result.success ? new TextDecoder().decode(result.stdout) : undefined;
};

const ytdlp = (ytdlpArgs: string[]) => [
    "--quiet",
    "--no-warnings",
    ...ytdlpArgs,
];

/** Converts `input` (a file or a URL) to `output`, sized to w × h. */
const ffmpeg = (
    input: string,
    output: string,
    w: number,
    h: number,
    options: string[],
) =>
    run("ffmpeg", [
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-vf",
        fit === "cover"
            ? `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},setsar=1`
            : `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
        ...options,
        output,
    ]);

/** A still image as a JPEG. */
const still = (input: string, output: string, w: number, h: number) =>
    ffmpeg(input, output, w, h, ["-frames:v", "1", "-q:v", "3"]);

const exists = (path: string) => {
    try {
        Deno.statSync(path);
        return true;
    } catch {
        return false;
    }
};

/** The fields of yt-dlp's info JSON used here. */
interface Info {
    id: string;
    title: string;
    webpage_url: string;
    duration?: number;
    like_count?: number;
    uploader_id?: string;
    channel?: string;
    uploader?: string;
    channel_id?: string;
    channel_url?: string;
    thumbnails?: {
        id?: string;
        url: string;
        width?: number;
        height?: number;
    }[];
}

/** One video in the manifest, as src/data/shorts.ts reads it. */
interface Entry {
    id: string;
    url: string;
    title: string;
    /** Like an @handle, without the @. */
    channel: string;
    /** The channel's id, naming its file in avatars/. */
    avatar?: string;
    likes: number;
}

/**
 * The channel's avatar, once per channel. YouTube lists it among the
 * channel page's thumbnails; elsewhere, the squarest one stands in.
 */
const fetchAvatar = async (info: Info) => {
    if (!info.channel_id || !info.channel_url) return undefined;
    const path = `${out}/avatars/${info.channel_id}.jpg`;
    if (exists(path)) return info.channel_id;
    const json = await capture(
        "yt-dlp",
        ytdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--playlist-items",
            "0",
            info.channel_url,
        ]),
    );
    const thumbnails = json
        ? ((JSON.parse(json) as Info).thumbnails ?? [])
        : [];
    const avatar =
        thumbnails.find((thumbnail) => thumbnail.id === "avatar_uncropped") ??
        thumbnails
            .filter((t) => t.width && t.width === t.height)
            .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    if (!avatar || !(await still(avatar.url, path, 96, 96))) {
        console.warn(`  No avatar for ${info.channel_url}`);
        return undefined;
    }
    return info.channel_id;
};

/**
 * Downloads the video and its thumbnail, and converts them to <base>.mp4
 * and <base>.jpg. `json` is its info, which saves asking the site again.
 */
const fetchVideo = async (json: string, base: string) => {
    const dir = await Deno.makeTempDir();
    try {
        await Deno.writeTextFile(`${dir}/info.json`, json);
        const fetched = await run(
            "yt-dlp",
            ytdlp([
                "--load-info-json",
                `${dir}/info.json`,
                "--format",
                "bv*+ba/b",
                // The smallest stream that is still as wide as the frame
                // (res is the shorter side), and the lightest sound.
                "--format-sort",
                `res:${width},+abr`,
                "--write-thumbnail",
                "--output",
                `${dir}/video.%(ext)s`,
                "--output",
                `thumbnail:${dir}/thumbnail.%(ext)s`,
            ]),
        );
        const files = [...Deno.readDirSync(dir)].map((file) => file.name);
        const video = files.find((name) => name.startsWith("video."));
        const thumbnail = files.find((name) => name.startsWith("thumbnail."));
        if (!fetched || !video) return false;

        const converted = await ffmpeg(
            `${dir}/${video}`,
            `${base}.mp4`,
            width,
            height,
            [
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                String(crf),
                "-profile:v",
                "high",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                "-ac",
                "2",
                // So it starts playing before it has all downloaded
                "-movflags",
                "+faststart",
                // Phone screens gain nothing from more, and it costs a lot.
                "-fpsmax",
                "30",
                "-map_metadata",
                "-1",
                "-sn",
                "-dn",
            ],
        );
        // Without a thumbnail, the first frame is the poster.
        return (
            converted &&
            (await still(
                thumbnail ? `${dir}/${thumbnail}` : `${base}.mp4`,
                `${base}.jpg`,
                width,
                height,
            ))
        );
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
};

/** Downloads one video, unless it already is, and describes it. */
const download = async (url: string): Promise<Entry | undefined> => {
    const json = await capture(
        "yt-dlp",
        ytdlp(["--dump-single-json", "--no-playlist", url]),
    );
    if (!json) return undefined;
    const info = JSON.parse(json) as Info;
    if (info.duration && info.duration > maxDuration) {
        console.warn(`  Longer than ${maxDuration}s`);
        return undefined;
    }

    const base = `${out}/${info.id}`;
    if (exists(`${base}.mp4`) && exists(`${base}.jpg`)) {
        console.log("  Already downloaded");
    } else if (!(await fetchVideo(json, base))) {
        return undefined;
    }

    // YouTube's uploader_id is the @handle.
    const channel = (info.uploader_id ?? info.channel ?? info.uploader ?? "")
        .replace(/^@/, "")
        .trim();
    return {
        id: info.id,
        url: info.webpage_url,
        title: info.title,
        channel: channel || "unknown",
        avatar: await fetchAvatar(info),
        likes: info.like_count ?? 0,
    };
};

await Deno.mkdir(`${out}/avatars`, { recursive: true });
const entries: Entry[] = [];
for (const [index, url] of urls.entries()) {
    console.log(`[${index + 1}/${urls.length}] ${url}`);
    const entry = await download(url);
    if (!entry) console.warn("  Left out");
    else if (!entries.some(({ id }) => id === entry.id)) entries.push(entry);
}
await Deno.writeTextFile(
    `${out}/manifest.json`,
    `${JSON.stringify(entries, null, 4)}\n`,
);
console.log(`Wrote ${entries.length} of ${urls.length} to ${out}`);
