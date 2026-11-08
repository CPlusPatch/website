/*
 * The Display menu's Compare row: each section of a component page, in light
 * and dark side by side, or in every theme or style. The copies are frames of the
 * section's own page (/gallery/story/<group>/), not the stories rendered
 * twice, since many stories carry ids and named radios that would clash.
 *
 * A frame can't size itself to its content, so this grows each one to its
 * page's height. Without JS there are no frames, and the row stays hidden,
 * as it does on pages without sections.
 */

import { STYLES } from "@cpluspatch/ui/styles/styles/index.ts";
import { THEMES } from "@cpluspatch/ui/styles/themes/index.ts";

type Mode = "page" | "schemes" | "themes" | "styles";

interface Copy {
    label: string;
    params: Record<string, string>;
}

/** Past this, a story sized to the viewport would grow its frame forever. */
const MAX_HEIGHT = 2400;

/**
 * The copies a mode shows. Each frame reads the saved Display choices for
 * the rest, as any page does, so only the compared one goes in its URL.
 */
const copies = (mode: Mode): Copy[] =>
    mode === "schemes"
        ? [
              { label: "Light", params: { scheme: "light" } },
              { label: "Dark", params: { scheme: "dark" } },
          ]
        : mode === "styles"
          ? STYLES.map((s) => ({ label: s.label, params: { style: s.value } }))
          : THEMES.map((t) => ({
                label: t.label,
                params: { theme: t.value },
            }));

/** Keeps a frame as tall as its page's main, and its links out of it. */
const fit = (frame: HTMLIFrameElement) => {
    let observer: ResizeObserver | undefined;
    frame.addEventListener("load", () => {
        observer?.disconnect();
        const doc = frame.contentDocument;
        const main = doc?.querySelector("main");
        if (!doc || !main) return;
        // Open alone, the section's own links: in the page, not the frame.
        for (const link of doc.querySelectorAll("a[href]")) {
            link.setAttribute("target", "_top");
        }
        observer = new ResizeObserver(() => {
            const height = Math.min(Math.ceil(main.offsetHeight), MAX_HEIGHT);
            if (Math.abs(frame.offsetHeight - height) > 1) {
                frame.style.height = `${height}px`;
            }
        });
        observer.observe(main);
    });
};

const render = (section: HTMLElement, mode: Mode) => {
    const body = section.querySelector<HTMLElement>(".story-group__body");
    if (!body) return;
    section.querySelector(".story-group__compare")?.remove();
    body.hidden = mode !== "page";
    if (mode === "page") return;

    const grid = document.createElement("div");
    grid.className = "story-group__compare";
    // A table wants the whole width: one copy above the other.
    grid.classList.toggle(
        "story-group__compare--stacked",
        Boolean(body.querySelector(".story-group__matrix")),
    );
    for (const copy of copies(mode)) {
        const figure = document.createElement("figure");
        const caption = document.createElement("figcaption");
        caption.className = "text-meta";
        caption.textContent = copy.label;
        const frame = document.createElement("iframe");
        frame.title = `${copy.label}: ${section.getAttribute("aria-label") ?? section.querySelector("h2")?.textContent ?? section.id}`;
        frame.loading = "lazy";
        fit(frame);
        frame.src = `/gallery/story/${section.id}/?${new URLSearchParams(copy.params)}`;
        figure.append(caption, frame);
        grid.append(figure);
    }
    body.after(grid);
};

export const initCompare = (control: HTMLElement) => {
    if (!document.querySelector("section.story-group")) return;
    control.hidden = false;

    const mode = (): Mode =>
        (control.querySelector<HTMLInputElement>("input:checked")
            ?.value as Mode) ?? "page";
    const update = () => {
        for (const section of document.querySelectorAll<HTMLElement>(
            "section.story-group",
        )) {
            render(section, mode());
        }
    };

    // Any other Display choice was just saved: reload, to pick it up.
    document.addEventListener("change", (event) => {
        const target = event.target as Element;
        if (control.contains(target)) update();
        else if (mode() !== "page" && target.closest(".display-menu")) {
            requestAnimationFrame(update);
        }
    });
    // A radio restored by the browser on back/forward.
    if (mode() !== "page") update();
};
