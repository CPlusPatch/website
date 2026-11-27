import { h } from "@cpluspatch/render";
import type { Document } from "@cpluspatch/sim";
import { MAX_INFLATED_BYTES, parseDocumentJson } from "../../persistence.ts";
import type { Status } from "./status.ts";

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

/** Reads a scenario file, or says what's wrong with it. */
export const readScenarioFile = async (
    file: File,
): Promise<{ ok: true; doc: Document } | { ok: false; status: Status }> => {
    if (file.size > MAX_INFLATED_BYTES) {
        return { ok: false, status: "The file is too big to be a scenario." };
    }

    let text: string;
    try {
        text = await file.text();
    } catch {
        return { ok: false, status: "The file couldn't be read." };
    }

    const result = parseDocumentJson(text);
    if (!result.ok) return { ok: false, status: { invalid: result.errors } };

    return { ok: true, doc: result.doc };
};
