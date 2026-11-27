import { type ClassValue, cx } from "../lib/classes.ts";

export type { PreviewWidth } from "../lib/preview-width.ts";

export interface PreviewFrameOptions {
    class?: ClassValue;
}

/** The classes of a <PreviewFrame>. */
export const previewFrameClasses = ({
    class: className,
}: PreviewFrameOptions = {}): string[] => cx("preview-frame", className);
