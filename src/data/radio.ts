/**
 * The music for <Radio>: the tracks `deno run radio` downloaded into
 * radio/ (see packages/mixtape and radio-tracks.txt), which are gitignored
 * as they are not ours. Without any, as on CI unless it is given them, the
 * radio has no tracks.
 */
import type { ComponentProps } from "astro/types";
import type Radio from "../components/blocks/radio/radio.astro";

type Track = ComponentProps<typeof Radio>["tracks"][number];

/** One track in the downloader's manifest.json (see packages/mixtape). */
interface Downloaded {
    id: string;
    title: string;
    artist?: string;
}

/** Each file in `files`, by its name without the extension. */
const byName = <T>(files: Record<string, T>) =>
    new Map(
        Object.entries(files).map(([path, value]) => [
            path.replace(/^.*\/|\.\w+$/g, ""),
            value,
        ]),
    );

// Empty when the folder is missing, so the build never needs it. Vite
// only takes the options written out in each call.
const manifest = Object.values(
    import.meta.glob<Downloaded[]>("./radio/manifest.json", {
        eager: true,
        import: "default",
    }),
)[0];
const sounds = byName(
    import.meta.glob<string>("./radio/*.ogg", {
        eager: true,
        import: "default",
        query: "?url",
    }),
);
const covers = byName(
    import.meta.glob<ImageMetadata>("./radio/*.jpg", {
        eager: true,
        import: "default",
    }),
);

/** In the downloaded list's order, leaving out any whose sound is missing. */
export const radioTracks: Track[] = (manifest ?? []).flatMap((track) => {
    const src = sounds.get(track.id);
    if (!src) return [];
    return [
        {
            src,
            cover: covers.get(track.id),
            title: track.title,
            artist: track.artist,
        },
    ];
});
