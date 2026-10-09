import stillAlive from "../../audio/Portal2-3x26_Still_Alive_Radio Mix_Clean.ogg";
import AudioPlayer from "../../components/blocks/audio-player.astro";
import { type StoryGroup, story } from "../story.ts";

export const audioPlayer: StoryGroup[] = [
    {
        id: "audio-player",
        title: "Audio player",
        category: "media",
        source: "blocks/audio-player.astro",
        description: "Falls back to the browser's own player without JS.",
        min: 24,
        stories: [
            story("default", AudioPlayer, { src: stillAlive }),
            story("titled", AudioPlayer, {
                src: stillAlive,
                title: "Still Alive (Radio Mix)",
            }),
            story("secondary", AudioPlayer, {
                src: stillAlive,
                title: "Still Alive (Radio Mix)",
                tone: "secondary",
            }),
            story("unframed", AudioPlayer, {
                src: stillAlive,
                title: "Still Alive (Radio Mix)",
                framed: false,
            }),
        ],
    },
];
