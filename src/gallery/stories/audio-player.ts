import testTone from "../../audio/test-tone.ogg";
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
            story("default", AudioPlayer, { src: testTone }),
            story("titled", AudioPlayer, {
                src: testTone,
                title: "Test Tone",
            }),
            story("secondary", AudioPlayer, {
                src: testTone,
                title: "Test Tone",
                tone: "secondary",
            }),
            story("unframed", AudioPlayer, {
                src: testTone,
                title: "Test Tone",
                framed: false,
            }),
        ],
    },
];
