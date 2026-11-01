import ContactMethod from "../../components/blocks/contact-method.astro";
import { type StoryGroup, story } from "../story.ts";

export const contactMethod: StoryGroup[] = [
    {
        id: "contact-method",
        title: "Contact methods",
        category: "content",
        source: "blocks/contact-method.astro",
        min: 14,
        stories: [
            story("default", ContactMethod, {
                name: "GitHub",
                href: "https://github.com/example",
                icon: "lucide:github",
                handle: "github.com/example",
            }),
            story("copyable", ContactMethod, {
                name: "Email",
                href: "mailto:test@example.com",
                icon: "lucide:at-sign",
                handle: "test@example.com",
                copy: "test@example.com",
            }),
            story("name-only", ContactMethod, {
                name: "Email",
                href: "mailto:test@example.com",
                icon: "lucide:at-sign",
            }),
        ],
    },
];
