import type { SpectralClass, Star } from "../../render/src/stars.ts";

const HEADER_BYTES = 28;
const ENTRY_BYTES = 32;

const CLASS_LETTERS = ["O", "B", "A", "F", "G", "K", "M"];

/** The stars of a BSC5 file, without the deleted entries. */
export const parseBsc5 = (bytes: Uint8Array): Star[] => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // A negative STARN means J2000 positions.
    const count = Math.abs(view.getInt32(8, true));
    const entryBytes = view.getInt32(24, true);
    if (entryBytes !== ENTRY_BYTES) {
        throw new Error(
            `Expected ${ENTRY_BYTES} bytes per entry, got ${entryBytes}.`,
        );
    }
    if (bytes.length < HEADER_BYTES + count * ENTRY_BYTES) {
        throw new Error("The BSC5 file is shorter than its header says.");
    }

    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
        const at = HEADER_BYTES + i * ENTRY_BYTES;
        const ra = view.getFloat64(at + 4, true);
        const dec = view.getFloat64(at + 12, true);
        const type = String.fromCharCode(
            bytes[at + 20] ?? 0,
            bytes[at + 21] ?? 0,
        );
        // The catalogue marks a deleted star with no position and a blank type.
        if (ra === 0 && dec === 0 && type.trim() === "") continue;

        stars.push({
            ra,
            dec,
            mag: view.getInt16(at + 22, true) / 100,
            class: classOf(type),
        });
    }

    return stars;
};

const classOf = (type: string): SpectralClass => {
    const letter = type.charAt(0);

    return CLASS_LETTERS.includes(letter) ? (letter as SpectralClass) : "other";
};
