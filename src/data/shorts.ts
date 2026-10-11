/**
 * The videos for <Shorts>: samples, which are ours to publish.
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
