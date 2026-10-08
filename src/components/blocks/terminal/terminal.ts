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

export const run = (command: string): string => `Command not found: ${command}`;
