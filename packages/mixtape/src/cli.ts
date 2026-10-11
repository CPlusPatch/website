#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/// <reference types="deno" />
/**
 * Usage: cli.ts <URL or list file>... --out <dir> [options]
 *
 * Downloads music for <Radio>, in the order given: each track's sound as
 * Opus in an Ogg file, its cover art cut square, and its title and artist.
 * Made for YouTube Music links, but anything yt-dlp reads works. yt-dlp
 * fetches and ffmpeg converts, so both need to be installed.
 *
 * A list file has one URL per line; blank lines and lines starting with #
 * are skipped. A line can also give the title, the artist and the album,
 * which the site shows instead of what the upload is called (often a video
 * title, or an uploader's name):
 *
 *   https://music.youtube.com/watch?v=... | Aria Math | C418 | Minecraft
 *
 * Tracks already in <dir> are not downloaded again, so a list can grow over
 * time and be re-run.
 *
 *   --bitrate <kbps>     sound quality (default 96)
 *   --cover <n>          cover size in pixels, a square (default 320, twice
 *                        what the radio shows, for sharp screens)
 *   --max-duration <s>   skip anything longer (default 900)
 *   --retries <n>        times to try again when fetching a track fails,
 *                        as it does now and then (default 3)
 *
 * Writes, per track, <dir>/<id>.ogg and <id>.jpg, and <dir>/manifest.json,
 * which lists the tracks in order with their details, and is what the site
 * reads. Files of tracks no longer listed are left alone.
 */
import {
    attempt,
    capture,
    exists,
    readUrls,
    run,
    takeNumber,
    takeOption,
    ytdlp,
} from "../../grab/src/mod.ts";

const usage = "Usage: cli.ts <URL or list file>... --out <dir> [options]";

const args = [...Deno.args];
const out = takeOption(args, "out");
const bitrate = takeNumber(args, "bitrate", 96);
const coverSize = takeNumber(args, "cover", 320);
const maxDuration = takeNumber(args, "max-duration", 900);
const retries = takeNumber(args, "retries", 3);
const sources = args.filter((arg) => !arg.startsWith("--"));
if (!out || !sources.length) {
    console.error(usage);
    Deno.exit(2);
}

/** A list's lines, split into the URL and what it overrides. */
const requests = readUrls(sources).map((line) => {
    const [url, title, artist, album] = line
        .split("|")
        .map((part) => part.trim());
    return {
        url,
        title: title || undefined,
        artist: artist || undefined,
        album: album || undefined,
    };
});

/**
 * YouTube Music's text, tidied: full-width commas (as in "Ray Parker， Jr.")
 * become plain ones.
 */
const tidy = (text: string | undefined) =>
    text?.replace(/\s*，\s*/g, ", ").trim() || undefined;

/** An album without the "(Original Game Soundtrack)" every one is sold with. */
const tidyAlbum = (album: string | undefined) =>
    tidy(album?.replace(/\s*\([^()]*\b(?:Soundtrack|Score)\)$/i, ""));

/** The fields of yt-dlp's info JSON used here. */
interface Info {
    id: string;
    title: string;
    webpage_url: string;
    duration?: number;
    // Set for music that YouTube knows as a recording.
    track?: string;
    artist?: string;
    album?: string;
    creator?: string;
    channel?: string;
    uploader?: string;
}

/** One track in the manifest, as src/data/radio.ts reads it. */
interface Entry {
    id: string;
    url: string;
    title: string;
    artist?: string;
    album?: string;
}

/** Converts `input` to `output`, as ffmpeg is told by `options`. */
const ffmpeg = (input: string, output: string, options: string[]) =>
    run("ffmpeg", [
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        ...options,
        output,
    ]);

/**
 * Downloads the track and its thumbnail, and converts them to <base>.ogg
 * and <base>.jpg. `json` is its info, which saves asking the site again.
 */
const fetchTrack = async (json: string, base: string) => {
    const dir = await Deno.makeTempDir();
    try {
        await Deno.writeTextFile(`${dir}/info.json`, json);
        const fetched = await run(
            "yt-dlp",
            ytdlp([
                "--load-info-json",
                `${dir}/info.json`,
                // Converted anyway, so the best there is to start from.
                "--format",
                "ba/b",
                "--write-thumbnail",
                "--output",
                `${dir}/audio.%(ext)s`,
                "--output",
                `thumbnail:${dir}/thumbnail.%(ext)s`,
            ]),
        );
        const files = [...Deno.readDirSync(dir)].map((file) => file.name);
        const audio = files.find((name) => name.startsWith("audio."));
        const thumbnail = files.find((name) => name.startsWith("thumbnail."));
        if (!fetched || !audio) return false;

        const converted = await ffmpeg(`${dir}/${audio}`, `${base}.ogg`, [
            "-vn",
            "-c:a",
            "libopus",
            "-b:a",
            `${bitrate}k`,
            "-vbr",
            "on",
            "-ac",
            "2",
            "-map_metadata",
            "-1",
        ]);
        if (!converted) return false;
        // A cover is a nicety: without one, the radio draws a disc.
        if (thumbnail) {
            const covered = await ffmpeg(`${dir}/${thumbnail}`, `${base}.jpg`, [
                "-vf",
                `scale=${coverSize}:${coverSize}:force_original_aspect_ratio=increase:flags=lanczos,crop=${coverSize}:${coverSize}`,
                "-frames:v",
                "1",
                "-q:v",
                "3",
            ]);
            if (!covered) console.warn("  No cover");
        }
        return true;
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
};

/**
 * Downloads one track, unless it already is, and describes it. Each try
 * asks the site again: the links in an old answer expire, and a 403 on one
 * does not go away by trying it again.
 */
const download = async ({
    url,
    title,
    artist,
    album,
}: (typeof requests)[number]): Promise<Entry | undefined> => {
    let info: Info | undefined;
    let skipped = false;
    const done = await attempt(retries, async () => {
        const json = await capture(
            "yt-dlp",
            ytdlp(["--dump-single-json", "--no-playlist", url]),
        );
        if (!json) return false;
        info = JSON.parse(json) as Info;
        if (info.duration && info.duration > maxDuration) {
            console.warn(`  Longer than ${maxDuration}s`);
            skipped = true;
            return true;
        }
        const base = `${out}/${info.id}`;
        if (exists(`${base}.ogg`)) {
            console.log("  Already downloaded");
            return true;
        }
        return await fetchTrack(json, base);
    });
    if (!done || skipped || !info) return undefined;

    // Auto-generated channels are named "<artist> - Topic".
    const channel = (info.channel ?? info.uploader)
        ?.replace(/ - Topic$/, "")
        .trim();
    return {
        id: info.id,
        // As asked for: YouTube Music songs and their videos have different
        // ids, and webpage_url would turn a music.youtube.com link into the
        // video's.
        url,
        title: tidy(title ?? info.track ?? info.title) ?? info.id,
        artist: tidy(artist ?? info.artist ?? info.creator ?? channel),
        album: tidyAlbum(album ?? info.album),
    };
};

await Deno.mkdir(out, { recursive: true });
const entries: Entry[] = [];
for (const [index, request] of requests.entries()) {
    console.log(`[${index + 1}/${requests.length}] ${request.url}`);
    const entry = await download(request);
    if (!entry) console.warn("  Left out");
    else if (!entries.some(({ id }) => id === entry.id)) entries.push(entry);
}
await Deno.writeTextFile(
    `${out}/manifest.json`,
    `${JSON.stringify(entries, null, 4)}\n`,
);
console.log(`Wrote ${entries.length} of ${requests.length} to ${out}`);
