import Button from "@cpluspatch/ui/astro/ui/button.astro";
import TabList from "@cpluspatch/ui/astro/ui/tab-list.astro";
import TabPanel from "@cpluspatch/ui/astro/ui/tab-panel.astro";
import { type Story, type StoryGroup, story } from "../story.ts";
import Stack from "../story-stack.astro";

/** The bench inspector's width, so the tabs show at the size they're used. */
const INSPECTOR_WIDTH = "width: 18rem";

/** A tab list and a panel for each of its tabs, the first one selected. */
const tabs = (
    name: string,
    id: string,
    items: { value: string; label: string; changed?: boolean }[],
    actions: Story[] = [],
): Story =>
    story(
        name,
        Stack,
        { style: INSPECTOR_WIDTH },
        {
            children: [
                story(
                    "list",
                    TabList,
                    { id, label: "Inspector", items },
                    { children: actions },
                ),
                ...items.map((item, index) =>
                    story(
                        `${item.value}-panel`,
                        TabPanel,
                        { tabs: id, value: item.value, selected: index === 0 },
                        { slot: `<p>The ${item.label} panel.</p>` },
                    ),
                ),
            ],
        },
    );

const RESET = story(
    "reset",
    Button,
    { variant: "ghost", tone: "neutral", size: "sm" },
    { slot: "Reset" },
);

export const tabsGroup: StoryGroup[] = [
    {
        id: "tabs",
        title: "Tabs",
        category: "primitives",
        description:
            "A bar of tabs and the panels it switches, with the arrow keys, Home and End. A tab can show that its panel has changes, and the bar can end in actions.",
        min: 20,
        stories: [
            tabs("default", "tabs-default", [
                { value: "props", label: "Props" },
                { value: "look", label: "Look" },
            ]),
            tabs(
                "changed",
                "tabs-changed",
                [
                    { value: "props", label: "Props" },
                    { value: "look", label: "Look", changed: true },
                ],
                [RESET],
            ),
            tabs("many", "tabs-many", [
                { value: "props", label: "Props", changed: true },
                { value: "look", label: "Look" },
                { value: "events", label: "Events" },
                { value: "source", label: "Source" },
            ]),
        ],
    },
];
