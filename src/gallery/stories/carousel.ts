import Carousel from "../../components/blocks/carousel/carousel.astro";
import CarouselItem from "../../components/blocks/carousel/carousel-item.astro";
import CarouselPreview from "../../components/blocks/carousel/carousel-preview.astro";
import SideHero from "../../components/sections/side-hero.astro";
import Button from "../../components/ui/button.astro";
import Card from "../../components/ui/card.astro";
import greg from "../../images/greg.jpg";
import { type StoryGroup, story } from "../story.ts";

const SLIDES = [
    { title: "Side hero", body: "A slide can hold any component." },
    { title: "Plain card", body: "This is the second slide." },
    { title: "Another card", body: "This is the third slide." },
    { title: "Last one", body: "This is the fourth slide." },
];

export const carousel: StoryGroup[] = [
    {
        id: "carousel",
        title: "Carousel",
        category: "blocks",
        source: "blocks/carousel/",
        min: "full",
        stories: [
            story(
                "default",
                Carousel,
                { label: "Component examples" },
                {
                    children: [
                        story(
                            "slide-1",
                            CarouselItem,
                            {},
                            {
                                children: [
                                    story(
                                        "hero",
                                        SideHero,
                                        {
                                            image: {
                                                src: greg,
                                                alt: "Greg Heffley",
                                            },
                                        },
                                        {
                                            slot: `<h2>${SLIDES[0].title}</h2><p>${SLIDES[0].body}</p>`,
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
                        ...SLIDES.slice(1).map((slide, i) =>
                            story(
                                `slide-${i + 2}`,
                                CarouselItem,
                                {},
                                {
                                    children: [
                                        story(
                                            "card",
                                            Card,
                                            {},
                                            {
                                                slot: `<h3>${slide.title}</h3><p>${slide.body}</p>`,
                                            },
                                        ),
                                    ],
                                },
                            ),
                        ),
                    ],
                    slots: {
                        previews: SLIDES.map((slide, i) =>
                            story(
                                `preview-${i + 1}`,
                                CarouselPreview,
                                {},
                                {
                                    slot: `<strong>${i + 1}</strong>${slide.title}`,
                                },
                            ),
                        ),
                    },
                },
            ),
        ],
    },
];
