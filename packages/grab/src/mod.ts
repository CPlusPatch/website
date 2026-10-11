/// <reference types="deno" />
/**
 * What the downloader scripts share (reel for videos, mixtape for music):
 * reading their options and URL lists, running yt-dlp and ffmpeg, and
 * trying again when a site fails.
 */

/** Takes `--name <value>` out of `args`, returning the value if it was there. */
export const takeOption = (
    args: string[],
    name: string,
): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? undefined : args.splice(index, 2)[1];
};

/** Like takeOption, for a number, ending the script if it isn't one. */
export const takeNumber = (args: string[], name: string, fallback: number) => {
    const value = Number(takeOption(args, name) ?? fallback);
    if (!Number.isFinite(value) || value < 0) {
        console.error(`--${name} takes a number.`);
        Deno.exit(2);
    }
    return value;
};

/**
 * URLs as given, with list files read in their place. A list file has one
 * URL per line; blank lines and lines starting with # are skipped.
 */
export const readUrls = (sources: string[]) =>
    sources.flatMap((source) =>
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
export const run = async (command: string, commandArgs: string[]) =>
    (
        await new Deno.Command(command, {
            args: commandArgs,
            stdout: "null",
            stderr: "inherit",
        }).output()
    ).success;

/** Runs a command, returning what it printed, or undefined if it failed. */
export const capture = async (command: string, commandArgs: string[]) => {
    const result = await new Deno.Command(command, {
        args: commandArgs,
        stdout: "piped",
        stderr: "inherit",
    }).output();
    return result.success ? new TextDecoder().decode(result.stdout) : undefined;
};

/** yt-dlp's arguments, with its chatter turned off. */
export const ytdlp = (ytdlpArgs: string[]) => [
    "--quiet",
    "--no-warnings",
    ...ytdlpArgs,
];

export const exists = (path: string) => {
    try {
        Deno.statSync(path);
        return true;
    } catch {
        return false;
    }
};

/**
 * Runs a task until it gives a result, trying again after a pause that
 * doubles each time, up to `retries` more times. Sites fail now and then
 * (a 403, a dropped connection) and work on the next go.
 */
export const attempt = async <T>(
    retries: number,
    task: () => Promise<T | undefined | false>,
) => {
    for (let tries = 0; ; tries++) {
        const result = await task();
        if (result || tries >= retries) return result;
        console.warn(`  Trying again (${tries + 1} of ${retries})`);
        await new Promise((done) => setTimeout(done, 2000 * 2 ** tries));
    }
};
