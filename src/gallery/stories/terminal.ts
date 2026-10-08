import Terminal from "../../components/blocks/terminal/terminal.astro";
import { type StoryGroup, story } from "../story.ts";

export const terminal: StoryGroup[] = [
    {
        id: "terminal",
        title: "Terminal",
        category: "blocks",
        source: "blocks/terminal/",
        min: 24,
        stories: [
            story("default", Terminal, {
                entries: [
                    {
                        command: "whoami",
                        output: "jessew",
                    },
                    {
                        command: "uname -a",
                        output: "Linux web-ng 7.2.8-2-cachyos #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
                    },
                    {
                        command: "ls ~/projects",
                        output: "web-ng\nversia\ndotfiles",
                    },
                    {
                        command: "cat motd.txt",
                        output: "Welcome! Type a command below.\nTry `help` for a list of commands.",
                    },
                ],
            }),
            story("empty", Terminal, { entries: [] }),
            story("interactive", Terminal, {
                interactive: true,
            }),
            story("interactive with history", Terminal, {
                interactive: true,
                entries: [
                    {
                        command: "whoami",
                        output: "jessew",
                    },
                ],
            }),
        ],
    },
];
