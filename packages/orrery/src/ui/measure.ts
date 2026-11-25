import type { Attachment } from "svelte/attachments";
import { sheetSpace } from "./sheet.ts";

/**
 * Sets `--orrery-top-space`, `--orrery-bottom-space` and `--orrery-sheet-space` on `root`.
 * Attach it to the side panel, which sits between the top and bottom ones.
 */
export const measure =
    (
        root: HTMLElement,
        top: HTMLElement | undefined,
        bottom: HTMLElement | undefined,
    ): Attachment<HTMLElement> =>
    (side) => {
        // The top and bottom panels wrap to different heights.
        const observer = new ResizeObserver(() => {
            if (top) {
                root.style.setProperty(
                    "--orrery-top-space",
                    `${top.offsetHeight}px`,
                );
            }
            if (bottom) {
                root.style.setProperty(
                    "--orrery-bottom-space",
                    `${bottom.offsetHeight}px`,
                );
            }

            const boxes = [...side.children].map((card) =>
                card.getBoundingClientRect(),
            );
            const space = sheetSpace(
                side.getBoundingClientRect().bottom,
                boxes,
            );
            root.style.setProperty("--orrery-sheet-space", `${space}px`);
        });
        for (const panel of [top, bottom]) if (panel) observer.observe(panel);

        // The cards come and go, and the inspector arrives once the view is built.
        const watch = new MutationObserver(() => {
            for (const card of side.children) observer.observe(card);
        });
        for (const card of side.children) observer.observe(card);
        watch.observe(side, { childList: true });

        return () => {
            observer.disconnect();
            watch.disconnect();
            root.style.removeProperty("--orrery-top-space");
            root.style.removeProperty("--orrery-sheet-space");
            root.style.removeProperty("--orrery-bottom-space");
        };
    };
