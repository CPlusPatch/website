import ContactMethod from "../../components/blocks/contact-method.astro";
import { type StoryGroup, story } from "../story.ts";

export const contactMethod: StoryGroup[] = [
    {
        id: "contact-method",
        title: "Contact methods",
        category: "content",
        source: "src/components/blocks/contact-method.astro",
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
            story("long-handle", ContactMethod, {
                name: "Matrix",
                href: "https://matrix.to/#/@a-very-long-username:a-rather-long-homeserver.example.org",
                icon: "matrix",
                handle: "@a-very-long-username:a-rather-long-homeserver.example.org",
                copy: "@a-very-long-username:a-rather-long-homeserver.example.org",
            }),
            story("narrow-copyable", ContactMethod, {
                name: "Email",
                href: "mailto:test@example.com",
                icon: "lucide:at-sign",
                handle: "contact@cpluspatch.com",
                copy: "contact@cpluspatch.com",
                style: "max-inline-size: 15rem",
            }),
            story("short", ContactMethod, {
                name: "X",
                href: "https://example.com",
                icon: "lucide:globe",
                handle: "x.co",
            }),
            story("tone-success", ContactMethod, {
                name: "Signal",
                href: "https://signal.me/#eu/example",
                icon: "logos:signal",
                handle: "@example.95",
                copy: "example.95",
                tone: "success",
            }),
        ],
    },
];
