import PreviewFrame from "@cpluspatch/ui/astro/ui/preview-frame.astro";
import { BODY, type StoryGroup, story } from "../story.ts";
import { PREVIEW_SNAPS } from "../widths.ts";

const CONTENT = `<h2>Content</h2>${BODY}<p>A second paragraph, to see the text rewrap as the frame narrows.</p>`;

export const previewFrame: StoryGroup[] = [
    {
        id: "preview-frame",
        title: "Preview frames",
        category: "primitives",
        description:
            "Drag the right edge, or the ruler above, to set the width. It snaps to the named widths.",
        min: "full",
        stories: [
            story(
                "default",
                PreviewFrame,
                { widths: PREVIEW_SNAPS },
                { slot: CONTENT },
            ),
            story(
                "narrow",
                PreviewFrame,
                { widths: PREVIEW_SNAPS, value: 32 },
                { slot: CONTENT },
            ),
            story("no-widths", PreviewFrame, {}, { slot: CONTENT }),
        ],
    },
];
