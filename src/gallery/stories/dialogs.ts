import Button from "@cpluspatch/ui/astro/ui/button.astro";
import Dialog from "@cpluspatch/ui/astro/ui/dialog.astro";
import Input from "@cpluspatch/ui/astro/ui/input.astro";
import Select from "@cpluspatch/ui/astro/ui/select.astro";
import { type StoryGroup, story } from "../story.ts";

const BODY_KINDS = [
    { value: "planet", label: "Planet" },
    { value: "moon", label: "Moon" },
    { value: "asteroid", label: "Asteroid" },
];

const PARAGRAPH =
    "<p>Paragraphs stack with a gap between them. When the content is taller than the dialog's maximum height, the body scrolls and the header and footer stay put.</p>";

/** A footer button that closes the dialog with this id. */
const cancel = (id: string) =>
    story(
        "cancel",
        Button,
        {
            variant: "outline",
            tone: "neutral",
            commandfor: id,
            command: "close",
        },
        { slot: "Cancel" },
    );

/** A destructive footer button that closes the dialog with this id. */
const remove = (id: string) =>
    story(
        "remove",
        Button,
        { tone: "destructive", commandfor: id, command: "close" },
        { icon: "lucide:trash-2", slot: "Remove" },
    );

/** The Add body form, as a dialog with this id. */
const addBody = (name: string, id: string, inline: boolean) =>
    story(
        name,
        Dialog,
        {
            id,
            title: "Add a body",
            form: true,
            inline,
            trigger: inline ? undefined : "Open form (md)",
        },
        {
            children: [
                story("name", Input, {
                    label: "Name",
                    name: "name",
                    autofocus: !inline,
                    placeholder: "Name",
                }),
                story("kind", Select, {
                    label: "Kind",
                    name: "kind",
                    options: BODY_KINDS,
                }),
                story("mass", Input, {
                    label: "Mass in kilograms",
                    name: "mass",
                    type: "number",
                    placeholder: "Mass (kg)",
                }),
            ],
            slots: {
                footer: [
                    cancel(id),
                    story("add", Button, { type: "submit" }, { slot: "Add" }),
                ],
            },
        },
    );

export const dialogs: StoryGroup[] = [
    {
        id: "dialog",
        title: "Dialogs",
        category: "primitives",
        description:
            "Inline here so they can be seen; a modal centred over the page on wide screens and a bottom sheet on narrow ones. Open buttons show the real modal.",
        stories: [
            story(
                "confirm",
                Dialog,
                {
                    id: "story-dialog-confirm",
                    title: "Remove Earth?",
                    size: "sm",
                    inline: true,
                },
                {
                    slot: "<p>This also removes its 2 moons. You can't undo this.</p>",
                    slots: {
                        footer: [
                            cancel("story-dialog-confirm"),
                            remove("story-dialog-confirm"),
                        ],
                    },
                },
            ),
            addBody("form", "story-dialog-form", true),
            story(
                "long",
                Dialog,
                {
                    id: "story-dialog-long",
                    scrollable: true,
                    title: "A title that is long enough that it has to wrap onto a second line in the header",
                    inline: true,
                },
                {
                    slot: Array.from({ length: 6 }, () => PARAGRAPH).join(""),
                    slots: {
                        footer: [
                            story(
                                "done",
                                Button,
                                {
                                    commandfor: "story-dialog-long",
                                    command: "close",
                                },
                                { slot: "Done" },
                            ),
                        ],
                    },
                },
            ),
            story(
                "no-close",
                Dialog,
                {
                    id: "story-dialog-no-close",
                    title: "Saved",
                    size: "sm",
                    closeButton: false,
                    inline: true,
                },
                {
                    slot: "<p>Your changes are saved.</p>",
                    slots: {
                        footer: [
                            story(
                                "ok",
                                Button,
                                {
                                    commandfor: "story-dialog-no-close",
                                    command: "close",
                                },
                                { slot: "OK" },
                            ),
                        ],
                    },
                },
            ),
            story(
                "modal",
                Dialog,
                {
                    id: "story-dialog-modal",
                    title: "Remove Earth?",
                    size: "sm",
                    trigger: "Open confirm (sm)",
                },
                {
                    slot: "<p>This also removes its 2 moons. You can't undo this.</p>",
                    slots: {
                        footer: [
                            cancel("story-dialog-modal"),
                            remove("story-dialog-modal"),
                        ],
                    },
                },
            ),
            addBody("form-modal", "story-dialog-form-modal", false),
            story(
                "light-dismiss",
                Dialog,
                {
                    id: "story-dialog-light-dismiss",
                    title: "Light dismiss",
                    size: "sm",
                    trigger: "Open (click outside closes)",
                    lightDismiss: true,
                },
                {
                    slot: "<p>Click anywhere outside this dialog to close it.</p>",
                },
            ),
        ],
    },
];
