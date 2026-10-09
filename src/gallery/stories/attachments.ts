import Attachment from "../../components/blocks/attachment/attachment.astro";
import AttachmentGroup from "../../components/blocks/attachment/attachment-group.astro";
import Button from "../../components/ui/button.astro";
import greg from "../../images/greg.jpg";
import testPattern from "../../images/test-pattern.jpg";
import { SIZES, type StoryGroup, story } from "../story.ts";

/** An icon action, as it would sit in the `actions` slot. */
const action = (name: string, icon: string, label: string) =>
    story(
        name,
        Button,
        {
            size: "icon-sm",
            variant: "ghost",
            tone: "neutral",
            lift: false,
            "aria-label": label,
        },
        { icon },
    );

const remove = (file: string) => action("remove", "lucide:x", `Remove ${file}`);

export const attachments: StoryGroup[] = [
    {
        id: "attachment",
        title: "Attachments",
        category: "blocks",
        source: "blocks/attachment/attachment.astro",
        description:
            "The description names the state; colour and shimmer only echo it.",
        min: 18,
        stories: [
            story(
                "done",
                Attachment,
                { title: "cool-dashboard.pdf", icon: "lucide:file-text" },
                {
                    slot: "PDF · 2.4 MB",
                    slots: { actions: [remove("cool-dashboard.pdf")] },
                },
            ),
            story(
                "idle",
                Attachment,
                { title: "notes.md", icon: "lucide:file-text", state: "idle" },
                {
                    slot: "Ready to upload",
                    slots: { actions: [remove("notes.md")] },
                },
            ),
            story(
                "uploading",
                Attachment,
                {
                    title: "cool-report.xlsx",
                    icon: "lucide:file-spreadsheet",
                    state: "uploading",
                    progress: 64,
                },
                {
                    slot: "Uploading · 64%",
                    slots: { actions: [remove("cool-report.xlsx")] },
                },
            ),
            story(
                "processing",
                Attachment,
                {
                    title: "research-summary.pdf",
                    icon: "lucide:file-text",
                    state: "processing",
                },
                { slot: "Processing document" },
            ),
            story(
                "error",
                Attachment,
                { title: "recording.mov", state: "error" },
                {
                    slot: "Failed · File exceeds 100 MB",
                    slots: {
                        actions: [
                            action(
                                "retry",
                                "lucide:rotate-cw",
                                "Retry recording.mov",
                            ),
                            remove("recording.mov"),
                        ],
                    },
                },
            ),
            story(
                "image",
                Attachment,
                { title: "greg.jpg", image: greg },
                { slot: "JPG · 184 KB" },
            ),
            story(
                "link",
                Attachment,
                {
                    title: "test-pattern.jpg",
                    image: testPattern,
                    href: testPattern.src,
                    download: true,
                },
                {
                    slot: "Click to download",
                    slots: { actions: [remove("test-pattern.jpg")] },
                },
            ),
            story(
                "long-name",
                Attachment,
                {
                    title: "an-unreasonably-long-file-name-that-will-not-fit-v2-final-FINAL.tar.gz",
                    icon: "lucide:file-archive",
                },
                { slot: "TAR.GZ · 48.1 MB" },
            ),
            ...SIZES.map((size) =>
                story(
                    `size-${size}`,
                    Attachment,
                    { title: "main.ts", icon: "lucide:file-code", size },
                    {
                        slot: "TypeScript · 3 KB",
                        slots: { actions: [remove("main.ts")] },
                    },
                ),
            ),
        ],
    },
    {
        id: "attachment-vertical",
        title: "Attachments — vertical",
        category: "blocks",
        source: "blocks/attachment/attachment.astro",
        description: "For image previews: the media stacks above the name.",
        min: 10,
        stories: [
            ...SIZES.map((size) =>
                story(
                    size,
                    Attachment,
                    {
                        title: "greg.jpg",
                        image: greg,
                        orientation: "vertical",
                        size,
                    },
                    {
                        slot: "JPG · 184 KB",
                        slots: { actions: [remove("greg.jpg")] },
                    },
                ),
            ),
            story(
                "icon",
                Attachment,
                {
                    title: "slides.key",
                    icon: "lucide:presentation",
                    orientation: "vertical",
                },
                { slot: "Keynote · 12 MB" },
            ),
            story(
                "uploading",
                Attachment,
                {
                    title: "test-pattern.jpg",
                    image: testPattern,
                    orientation: "vertical",
                    state: "uploading",
                    progress: 30,
                },
                { slot: "Uploading · 30%" },
            ),
        ],
    },
    {
        id: "attachment-group",
        title: "Attachment groups",
        category: "blocks",
        source: "blocks/attachment/attachment-group.astro",
        description: "Scrolls sideways and snaps; the overflowing edges fade.",
        min: "full",
        stories: [
            story(
                "default",
                AttachmentGroup,
                { label: "Attachments" },
                {
                    children: [
                        story(
                            "pdf",
                            Attachment,
                            {
                                title: "cool-dashboard.pdf",
                                icon: "lucide:file-text",
                            },
                            {
                                slot: "PDF · 2.4 MB",
                                slots: {
                                    actions: [remove("cool-dashboard.pdf")],
                                },
                            },
                        ),
                        story(
                            "image",
                            Attachment,
                            { title: "greg.jpg", image: greg },
                            {
                                slot: "JPG · 184 KB",
                                slots: { actions: [remove("greg.jpg")] },
                            },
                        ),
                        story(
                            "uploading",
                            Attachment,
                            {
                                title: "cool-report.xlsx",
                                icon: "lucide:file-spreadsheet",
                                state: "uploading",
                                progress: 64,
                            },
                            { slot: "Uploading · 64%" },
                        ),
                        story(
                            "error",
                            Attachment,
                            { title: "recording.mov", state: "error" },
                            { slot: "Failed · Too large" },
                        ),
                        story(
                            "code",
                            Attachment,
                            { title: "main.ts", icon: "lucide:file-code" },
                            { slot: "TypeScript · 3 KB" },
                        ),
                    ],
                },
            ),
            story(
                "vertical",
                AttachmentGroup,
                { label: "Images" },
                {
                    children: [greg, testPattern, greg, testPattern, greg].map(
                        (image, i) =>
                            story(`image-${i}`, Attachment, {
                                title: `photo-${i + 1}.jpg`,
                                image,
                                orientation: "vertical",
                                size: "sm",
                            }),
                    ),
                },
            ),
        ],
    },
];
