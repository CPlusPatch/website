import testTone from "../../audio/test-tone.ogg";
import Radio from "../../components/blocks/radio/radio.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { type StoryGroup, story } from "../story.ts";

// One sound stands in for every track: a tone made with ffmpeg.
const tracks = [
    {
        src: testTone,
        title: "Test Tone",
        artist: "ffmpeg",
        cover: testPattern,
    },
    {
        src: testTone,
        title: "Test Pattern Blues",
        artist: "Greg",
        cover: greg,
    },
    {
        src: testTone,
        title: "Untitled Demo With No Cover",
        artist: "Unknown",
    },
    { src: testTone, title: "Instrumental" },
];

export const radio: StoryGroup[] = [
    {
        id: "radio",
        title: "Radio",
        category: "media",
        source: "blocks/radio/",
        description:
            "Without JS, the browser's own player for the first track, and links to each file.",
        min: 24,
        stories: [
            story("default", Radio, { tracks, name: "CPlusPatch FM" }),
            story("secondary", Radio, {
                tracks,
                name: "CPlusPatch FM",
                tone: "secondary",
            }),
            story("capped", Radio, {
                tracks: [...tracks, ...tracks],
                style: "max-block-size: 22rem",
            }),
            story("single track", Radio, { tracks: tracks.slice(0, 1) }),
            story("unframed", Radio, {
                tracks,
                name: "CPlusPatch FM",
                framed: false,
            }),
        ],
    },
];
