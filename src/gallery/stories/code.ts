import Code from "../../components/blocks/code.astro";
import { type StoryGroup, story } from "../story.ts";

const TS = `/** Writes the pointer position on each subscriber, once a frame. */
export const track = (targets: HTMLElement[]) => {
    let raf = 0;
    addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return; // touch has no hover
        raf ||= requestAnimationFrame(() => {
            raf = 0;
            for (const el of targets) el.style.setProperty("--x", \`\${event.clientX}\`);
        });
    });
};`;

const ASTRO = `---
import Button from "../components/ui/button.astro";

const { label = "Save" } = Astro.props;
---

<form method="post">
    <Button type="submit">{label}</Button>
</form>`;

const CSS = `.card {
    padding: var(--space-md);
    border: 1px solid var(--color-border);

    &:hover {
        border-color: var(--color-primary);
    }
}`;

const SHELL = `$ deno run build
✓ Completed in 1.2s
$ deno run check`;

const LONG = `const message = "A line long enough that it runs past the edge of the block, which shows whether it wraps or scrolls";`;

export const code: StoryGroup[] = [
    {
        id: "code",
        title: "Code",
        category: "content",
        source: "blocks/code.astro",
        description:
            "Highlighted at build time by Shiki, in the palette's colours. The copy button needs JS and is absent without it.",
        min: 28,
        stories: [
            story("typescript", Code, {
                code: TS,
                lang: "ts",
                title: "src/lib/pointer.ts",
            }),
            story("astro-numbered", Code, {
                code: ASTRO,
                lang: "astro",
                title: "save.astro",
                lineNumbers: true,
            }),
            story("css", Code, { code: CSS, lang: "css" }),
            story("shell", Code, { code: SHELL, lang: "shellsession" }),
            story("wrap", Code, { code: LONG, lang: "js", wrap: true }),
            story("scroll", Code, { code: LONG, lang: "js" }),
            story("plain", Code, { code: "No language: plain text." }),
            story("inline", Code, {
                code: "font: var(--type-code)",
                lang: "css",
                inline: true,
            }),
        ],
    },
];
