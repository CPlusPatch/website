import IconList from "../../components/ui/icon-list.astro";
import { type StoryGroup, story } from "../story.ts";

export const iconList: StoryGroup[] = [
    {
        id: "icon-list",
        title: "Icon lists",
        category: "content",
        source: "ui/icon-list.astro",
        min: 18,
        stories: [
            story("default", IconList, {
                items: [
                    { icon: "lucide:map-pin", label: "Somewhere on Earth" },
                    { icon: "lucide:clock", label: "UTC+1" },
                    { icon: "lucide:git-branch", label: "Open source first" },
                ],
            }),
            story("wrapping", IconList, {
                items: [
                    { icon: "lucide:briefcase", label: "Full-stack developer" },
                    { icon: "lucide:languages", label: "English, French" },
                    { icon: "lucide:coffee", label: "Runs on tea" },
                    { icon: "lucide:heart", label: "Likes accessible things" },
                    { icon: "lucide:music", label: "Portal soundtrack" },
                ],
            }),
        ],
    },
];
