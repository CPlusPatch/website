import Carousel from "../../components/blocks/carousel/carousel.astro";
import CarouselItem from "../../components/blocks/carousel/carousel-item.astro";
import SideHero from "../../components/sections/side-hero.astro";
import Button from "../../components/ui/button.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { type Story, type StoryGroup, story } from "../story.ts";

interface Slide {
    title: string;
    body: string;
    image: { src: ImageMetadata; alt: string };
    side: "left" | "right";
}

const SLIDES: Slide[] = [
    {
        title: "Any component",
        body: "A slide can hold any component. This one is a side hero.",
        image: { src: greg, alt: "Greg Heffley" },
        side: "right",
    },
    {
        title: "Sized to fit",
        body: "The track is as tall as its tallest slide, so nothing is clipped and the frame never jumps.",
        image: { src: testPattern, alt: "A TV test pattern" },
        side: "left",
    },
    {
        title: "Controls below",
        body: "Arrows, counter and pips sit in the footer, clear of slide content.",
        image: { src: greg, alt: "Greg Heffley" },
        side: "right",
    },
    {
        title: "Keyboard ready",
        body: "Focus the track and use the arrow keys, Home or End.",
        image: { src: testPattern, alt: "A TV test pattern" },
        side: "left",
    },
];

/** Enough slides that the pips overflow a phone-width footer. */
const MANY: Slide[] = Array.from({ length: 24 }, (_, i) => ({
    ...SLIDES[i % SLIDES.length],
    title: `Slide ${i + 1}`,
    body: "One of many, to see how the pips hold up.",
}));

const slides = (list = SLIDES): Story[] =>
    list.map((slide, i) =>
        story(
            `slide-${i + 1}`,
            CarouselItem,
            {},
            {
                children: [
                    story(
                        "hero",
                        SideHero,
                        { image: slide.image, side: slide.side },
                        {
                            slot: `<h2>${slide.title}</h2><p>${slide.body}</p>`,
                            children: [
                                story(
                                    "cta",
                                    Button,
                                    {},
                                    { slot: "Learn more" },
                                ),
                            ],
                        },
                    ),
                ],
            },
        ),
    );

export const carousel: StoryGroup[] = [
    {
        id: "carousel",
        title: "Carousel",
        category: "blocks",
        source: "blocks/carousel/",
        description: "Swipes and scrolls natively without JS.",
        min: "full",
        stories: [
            story(
                "default",
                Carousel,
                { label: "Carousel features" },
                { children: slides() },
            ),
            story(
                "many",
                Carousel,
                { label: "Many slides" },
                { children: slides(MANY) },
            ),
        ],
    },
];
