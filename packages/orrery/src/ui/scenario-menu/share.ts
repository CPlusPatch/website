import type { Document } from "@cpluspatch/sim";
import {
    encodeDocument,
    HASH_PREFIX,
    MAX_PAYLOAD_CHARS,
} from "../../persistence.ts";

/** The link that opens `doc` on the page at `base`, or why there isn't one. */
export const shareLink = async (
    doc: Document,
    base: string,
): Promise<{ ok: true; link: string } | { ok: false; message: string }> => {
    let payload: string;
    try {
        payload = await encodeDocument(doc);
    } catch {
        return { ok: false, message: "The link couldn't be made." };
    }

    if (payload.length > MAX_PAYLOAD_CHARS) {
        return {
            ok: false,
            message:
                "The scenario is too big to share as a link. Use Export instead.",
        };
    }

    return { ok: true, link: `${base}${HASH_PREFIX}${payload}` };
};
