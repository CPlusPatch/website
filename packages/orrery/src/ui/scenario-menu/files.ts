import { h } from "@cpluspatch/render";

/** The file name for a scenario called `name`. */
export const fileName = (name: string): string => {
    // Control characters and the ones most file systems refuse.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: that's the point
    const safe = name.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "").trim();

    return `${safe || "scenario"}.orrery.json`;
};

/** Saves `text` as a file called `filename` through a temporary link. */
export const download = (filename: string, text: string): void => {
    const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
    );
    const link = h("a", { href: url, download: filename });

    // Firefox ignores a click on an anchor that isn't in the document.
    document.body.append(link);
    link.click();
    link.remove();
    // The download may not have started yet.
    setTimeout(() => URL.revokeObjectURL(url), 0);
};
