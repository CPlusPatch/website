import Alert from "../../components/ui/alert.astro";
import { type StoryGroup, story } from "../story.ts";

export const alerts: StoryGroup[] = [
    {
        id: "alert",
        title: "Alerts",
        category: "primitives",
        source: "ui/alert.astro",
        min: 24,
        stories: [
            story(
                "default",
                Alert,
                {},
                {
                    slot: "<h3>Alert title</h3><p>An alert with no icon and no variant.</p>",
                },
            ),
            story(
                "success",
                Alert,
                { variant: "success", icon: "lucide:badge-check" },
                {
                    slot: "<h3>Success alert</h3><p>The action completed successfully.</p>",
                },
            ),
            story(
                "warning",
                Alert,
                { variant: "warning", icon: "lucide:alert-triangle" },
                {
                    slot: "<h3>Warning alert</h3><p>Something might need your attention.</p>",
                },
            ),
            story(
                "destructive",
                Alert,
                {
                    variant: "destructive",
                    icon: "lucide:alert-circle",
                    live: "assertive",
                },
                {
                    slot: "<h3>Destructive alert</h3><p>This action could have serious consequences.</p>",
                },
            ),
        ],
    },
];
