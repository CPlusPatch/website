import Rack from "../../components/blocks/rack/rack.astro";
import { rack as homelab } from "../../data/home.ts";
import { type StoryGroup, story } from "../story.ts";

export const rack: StoryGroup[] = [
    {
        id: "rack",
        title: "Rack",
        category: "toys",
        source: "blocks/rack/",
        description:
            "A server rack with traffic running through its units once scrolled into view.",
        stories: [
            story("traffic", Rack, homelab),
            story("still", Rack, {
                label: "rack-02",
                units: homelab.units.slice(0, 4),
            }),
        ],
    },
];
