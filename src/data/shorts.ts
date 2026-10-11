/**
 * The videos for <Shorts>: the samples, which are ours, and the ones
 * `deno run shorts` downloaded, which are gitignored as they are not, so
 * never show those anywhere that is published. Without any, as on CI,
 * `downloaded` is empty.
 */
import type { ComponentProps } from "astro/types";
import type Shorts from "../components/blocks/shorts/shorts.astro";
import greg from "../images/greg.jpg";
import gradientsPoster from "../images/shorts/gradients.jpg";
import lifePoster from "../images/shorts/life.jpg";
import mandelbrotPoster from "../images/shorts/mandelbrot.jpg";
import rule110Poster from "../images/shorts/rule-110.jpg";
import testPattern from "../images/test-pattern.jpg";
import gradients from "../video/shorts/gradients.mp4";
import life from "../video/shorts/life.mp4";
import mandelbrot from "../video/shorts/mandelbrot.mp4";
import rule110 from "../video/shorts/rule-110.mp4";

type Video = ComponentProps<typeof Shorts>["videos"][number];

/** Made with ffmpeg's built-in test sources, so they are ours to publish. */
export const samples: Video[] = [
    {
        src: mandelbrot,
        poster: mandelbrotPoster,
        title: "Zooming into the Mandelbrot set until something happens (nothing happens) #math #fractal",
        channel: "test-pattern",
        avatar: testPattern,
        likes: 48_213,
    },
    {
        src: life,
        poster: lifePoster,
        title: "Conway's Game of Life but the cells are pink",
        channel: "greg",
        avatar: greg,
        likes: 1_207,
    },
    {
        src: gradients,
        poster: gradientsPoster,
        title: "8 seconds of gradients to reset your brain",
        channel: "calm-pixels",
        likes: 312,
    },
    {
        src: rule110,
        poster: rule110Poster,
        title: "Rule 110 is Turing complete and it looks like this",
        channel: "test-pattern",
        avatar: testPattern,
        likes: 2_400_000,
    },
];

/** One video in the downloader's manifest.json (see packages/reel). */
interface Downloaded {
    id: string;
    title: string;
    channel: string;
    /** The channel's id, naming its file in avatars/. */
    avatar?: string;
    likes: number;
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
    import.meta.glob<Downloaded[]>("./shorts/manifest.json", {
        eager: true,
        import: "default",
    }),
)[0];
const videos = byName(
    import.meta.glob<string>("./shorts/*.mp4", {
        eager: true,
        import: "default",
        query: "?url",
    }),
);
const posters = byName(
    import.meta.glob<ImageMetadata>("./shorts/*.jpg", {
        eager: true,
        import: "default",
    }),
);
const avatars = byName(
    import.meta.glob<ImageMetadata>("./shorts/avatars/*.jpg", {
        eager: true,
        import: "default",
    }),
);

/** In the downloaded list's order, leaving out any whose video is missing. */
export const downloaded: Video[] = (manifest ?? []).flatMap((video) => {
    const src = videos.get(video.id);
    if (!src) return [];
    return [
        {
            src,
            poster: posters.get(video.id),
            title: video.title,
            channel: video.channel,
            avatar: video.avatar ? avatars.get(video.avatar) : undefined,
            likes: video.likes,
        },
    ];
});
