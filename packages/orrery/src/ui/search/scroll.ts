import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

/** Fades the foot of a list while more rows are below. */
export const updateMore = (list: HTMLElement | undefined): void => {
    list?.toggleAttribute(
        "data-more",
        list.scrollTop + list.clientHeight < list.scrollHeight - 1,
    );
};

/** Keeps `updateMore` current as the list scrolls. */
export const more: Attachment<HTMLElement> = (node) =>
    on(node, "scroll", () => updateMore(node), { passive: true });
