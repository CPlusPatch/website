import Avatar from "../../components/ui/avatar.astro";
import greg from "../../images/greg.jpg";
import { SIZES, type StoryGroup, story } from "../story.ts";

export const avatars: StoryGroup[] = [
    {
        id: "avatar",
        title: "Avatars",
        category: "primitives",
        source: "ui/avatar.astro",
        description: "Initials stand in when there is no image.",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(size, Avatar, { src: greg, alt: "Greg Heffley", size }),
            ),
            ...SIZES.map((size) =>
                story(`initials-${size}`, Avatar, {
                    alt: "Greg Heffley",
                    size,
                }),
            ),
            story("initials-single-word", Avatar, { alt: "Greg" }),
            story("initials-long-name", Avatar, {
                alt: "Gregory Hamilton Heffley",
            }),
        ],
    },
];
