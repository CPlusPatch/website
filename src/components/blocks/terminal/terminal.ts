import badApple from "../../../data/bad-apple/video.webm?url";
import { shake, uwuify } from "../../../lib/page-effects.ts";
import { playVideo } from "./video.ts";

export interface Entry {
    command: string;
    output: string;
}

export const promptFor = (cwd: string): string =>
    `guest@cpluspatch.com:${cwd}$ `;

/**
 * A command that runs on after it returns, drawing into its output itself.
 * It calls `done` when it finishes, and returns a function that stops it
 * sooner, called on Ctrl+C or the next command.
 */
export type Program = (output: HTMLElement, done: () => void) => () => void;

export const neofetch =
    (): string => `                            jessew@website
    _____  __      __       --------------
   /\\___ \\/\\ \\  __/\\ \\      OS: JesseOS 2026.10
   \\/__/\\ \\ \\ \\/\\ \\ \\ \\     Host: cpluspatch.com
      _\\ \\ \\ \\ \\ \\ \\ \\ \\    Kernel: Linux
     /\\ \\_\\ \\ \\ \\_/ \\_\\ \\   Uptime: Who knows!
     \\ \\____/\\ \`\\___x___/   Packages: 6767 (jacman)
      \\/___/  '\\/__//__/    Shell: jash 0.22.1
                            Display (BROWSER): [Built-in]
`;

export const whoami = (): string => "jessew";

/** Undoes the page's uwuification, while it's on. */
let unUwu: (() => void) | undefined;

/** Uwuifies the whole page, or puts it back if it already is. */
export const uwu = (): string => {
    if (unUwu) {
        unUwu();
        unUwu = undefined;
        return "Back to normal.";
    }
    unUwu = uwuify();
    return "Evewything is uwu now (ᵘʷᵘ)";
};

/** What a command returns to have the terminal empty itself, like `clear`. */
export const CLEAR = Symbol("clear");

export type Result = string | Program | typeof CLEAR;

/**
 * The film for the `movie` command: the one `deno run movie` made, which is
 * gitignored, or else one hosted elsewhere at PUBLIC_MOVIE_URL, as CI sets.
 * Without either, the build has no `movie` command.
 */
const movie: string | undefined =
    Object.values(
        import.meta.glob<string>("../../../data/movie/video.webm", {
            query: "?url",
            import: "default",
            eager: true,
        }),
    )[0] || import.meta.env.PUBLIC_MOVIE_URL;

/** Every command, in the order `help` lists them. */
const commands: {
    names: string[];
    description: string;
    run: () => Result;
}[] = [
    {
        names: ["fastfetch", "neofetch"],
        description: "Display system information",
        run: neofetch,
    },
    { names: ["whoami"], description: "Display the current user", run: whoami },
    {
        names: ["help"],
        description: "Display this help message",
        run: () => help(),
    },
    { names: ["clear"], description: "Clear the terminal", run: () => CLEAR },
    { names: ["uwu"], description: "Uwuify the page, or undo it", run: uwu },
    {
        names: ["shake"],
        description: "Shake the page",
        run: () => {
            void shake();
            return "*rumble*";
        },
    },
    {
        names: ["badapple"],
        description: "Play Bad Apple!!, with sound (Ctrl+C to stop)",
        run: () => playVideo(badApple, "Bad Apple!!"),
    },
    ...(movie
        ? [
              {
                  names: ["movie"],
                  description: "Play a movie, in colour (Ctrl+C to stop)",
                  run: () => playVideo(movie, "the movie"),
              },
          ]
        : []),
];

export const help = (): string =>
    `Available commands:\n${commands
        .map(
            ({ names, description }) =>
                `  ${names.join(", ").padEnd(21)}- ${description}\n`,
        )
        .join("")}`;

export const run = (command: string): Result =>
    commands.find(({ names }) => names.includes(command))?.run() ??
    `bash: ${command}: command not found`;
