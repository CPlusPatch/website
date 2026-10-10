import stillAlive from "../../audio/radio/still-alive-radio-mix-clean.ogg";
import Radio from "../../components/blocks/radio/radio.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { type StoryGroup, story } from "../story.ts";

// One file stands in for every track.
const tracks = [
    {
        src: stillAlive,
        title: "Still Alive (Radio Mix)",
        artist: "Jonathan Coulton",
        cover: testPattern,
    },
    {
        src: stillAlive,
        title: "Test Pattern Blues",
        artist: "Greg",
        cover: greg,
    },
    {
        src: stillAlive,
        title: "Untitled Demo With No Cover",
        artist: "Unknown",
    },
    { src: stillAlive, title: "Instrumental" },
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
            story("default", Radio, { tracks, name: "Jesse FM" }),
            story("secondary", Radio, {
                tracks,
                name: "Jesse FM",
                tone: "secondary",
            }),
            story("capped", Radio, {
                tracks: [...tracks, ...tracks],
                style: "max-block-size: 22rem",
            }),
            story("single track", Radio, { tracks: tracks.slice(0, 1) }),
            story("unframed", Radio, {
                tracks,
                name: "Jesse FM",
                framed: false,
            }),
        ],
    },
];
