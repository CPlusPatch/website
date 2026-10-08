import MediaPlayer from "../../components/blocks/media-player.astro";
import poster from "../../images/test-pattern.jpg";
import captions from "../../video/test-pattern.en.vtt?url";
import mp4 from "../../video/test-pattern.mp4";
import webm from "../../video/test-pattern.webm";
import { type StoryGroup, story } from "../story.ts";

const src = [
    { src: webm, type: "video/webm" },
    { src: mp4, type: "video/mp4" },
];

export const mediaPlayer: StoryGroup[] = [
    {
        id: "media-player",
        title: "Media player",
        category: "media",
        source: "blocks/media-player.astro",
        description:
            "Falls back to the browser's own player without JS. K, J/L, M, C and F work while focus is inside.",
        min: 24,
        stories: [
            story("default", MediaPlayer, { src: mp4 }),
            story("titled", MediaPlayer, {
                src,
                poster,
                title: "Test pattern",
            }),
            story("captions", MediaPlayer, {
                src,
                poster,
                title: "Test pattern",
                tracks: [
                    {
                        src: captions,
                        srclang: "en",
                        label: "English",
                        default: true,
                    },
                ],
                tone: "secondary",
            }),
        ],
    },
];
