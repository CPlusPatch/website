import { shake, uwuify } from "../../../lib/page-effects.ts";

export interface Entry {
    command: string;
    output: string;
}
export interface SubmitDetail {
    command: string;
    entries: Entry[];
}

export const promptFor = (cwd: string): string =>
    `guest@cpluspatch.com:${cwd}$ `;

export const run = (command: string): string => {
    switch (command) {
        case "fastfetch":
        case "neofetch":
            return neofetch();
        case "whoami":
            return whoami();
        case "help":
            return help();
        case "uwu":
            return uwu();
        case "shake":
            void shake();
            return "*rumble*";
        default:
            return `bash: ${command}: command not found`;
    }
};

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

export const help = (): string => `Available commands:
  fastfetch, neofetch  - Display system information
  whoami               - Display the current user
  help                 - Display this help message
  uwu                  - Uwuify the page, or undo it
  shake                - Shake the page
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
