import ControlRow from "@cpluspatch/ui/astro/ui/control-row.astro";
import Input from "@cpluspatch/ui/astro/ui/input.astro";
import SegmentedControl from "@cpluspatch/ui/astro/ui/segmented-control.astro";
import Select from "@cpluspatch/ui/astro/ui/select.astro";
import SwatchPicker from "@cpluspatch/ui/astro/ui/swatch-picker.astro";
import Textarea from "@cpluspatch/ui/astro/ui/textarea.astro";
import Tile from "@cpluspatch/ui/astro/ui/tile.astro";
import TilePicker from "@cpluspatch/ui/astro/ui/tile-picker.astro";
import Toggle from "@cpluspatch/ui/astro/ui/toggle.astro";
import { type Story, type StoryGroup, story } from "../story.ts";

const SELECT_OPTIONS = [
    { value: "one", label: "Option one" },
    { value: "two", label: "Option two" },
    { value: "three", label: "Option three" },
];

const VIEW_OPTIONS = [
    { value: "list", label: "List" },
    { value: "grid", label: "Grid" },
    { value: "board", label: "Board" },
];

const TONE_SWATCHES = [
    { value: "primary", label: "Primary", color: "var(--color-primary)" },
    { value: "secondary", label: "Secondary", color: "var(--color-secondary)" },
    {
        value: "destructive",
        label: "Destructive",
        color: "var(--color-destructive)",
    },
    { value: "warning", label: "Warning", color: "var(--color-warning)" },
    { value: "success", label: "Success", color: "var(--color-success)" },
    { value: "neutral", label: "Neutral", color: "var(--color-text-muted)" },
];

const THEME_SWATCHES = [
    { value: "default", label: "Default", color: "#0f0f10", accent: "#f48fb1" },
    { value: "nord", label: "Nord", color: "#2e3440", accent: "#88c0d0" },
    { value: "gruvbox", label: "Gruvbox", color: "#282828", accent: "#fe8019" },
    {
        value: "catppuccin",
        label: "Catppuccin",
        color: "#1e1e2e",
        accent: "#cba6f7",
    },
];

const SPECIMENS = [
    { value: "poster", caption: "Poster", font: "Impact, sans-serif" },
    { value: "soft", caption: "Soft", font: "system-ui, sans-serif" },
    { value: "print", caption: "Print", font: "Georgia, serif" },
    { value: "mono", caption: "Mono", font: "ui-monospace, monospace" },
];

const BOXES = [
    { value: "small", label: "Small", width: "0.5rem", height: "0.375rem" },
    { value: "medium", label: "Medium", width: "0.875rem", height: "0.625rem" },
    { value: "large", label: "Large", width: "1.25rem", height: "0.875rem" },
];

/** The bench inspector's width, so tiles show at the size they're used. */
const INSPECTOR_WIDTH = "width: 18rem";

const BOX_PREVIEW =
    '<span style="width: 0.875rem; height: 0.625rem; border: 1.5px solid currentColor"></span>';

const specimenPreview = (font: string) =>
    `<span style="font: 600 1.75rem/1 ${font}">Aa</span>`;

/** Tiles drawn as the word "Aa" in a font, captioned. */
const specimenTiles = (name: string, checked: string): Story[] =>
    SPECIMENS.map(({ value, caption, font }) =>
        story(
            value,
            Tile,
            {
                name,
                value,
                label: caption,
                caption,
                checked: value === checked,
            },
            { slot: specimenPreview(font) },
        ),
    );

/** Tiles drawn as an outlined box, with no caption. */
const boxTiles = (name: string, checked: string): Story[] =>
    BOXES.map(({ value, label, width, height }) =>
        story(
            value,
            Tile,
            { name, value, label, checked: value === checked },
            {
                slot: `<span style="width: ${width}; height: ${height}; border: 1.5px solid currentColor"></span>`,
            },
        ),
    );

const ALIGN_OPTIONS = [
    { value: "left", label: "Align left", icon: "lucide:align-left" },
    { value: "center", label: "Align center", icon: "lucide:align-center" },
    { value: "right", label: "Align right", icon: "lucide:align-right" },
];

export const forms: StoryGroup[] = [
    {
        id: "toggle",
        title: "Toggles",
        category: "forms",
        min: 10,
        stories: [
            story("default", Toggle, { label: "Example" }),
            story("checked", Toggle, { label: "Example", checked: true }),
            story("disabled", Toggle, { label: "Example", disabled: true }),
            story("checked-disabled", Toggle, {
                label: "Example",
                checked: true,
                disabled: true,
            }),
            story(
                "with-text",
                Toggle,
                { label: "Example" },
                { slot: "Example" },
            ),
        ],
    },
    {
        id: "select",
        title: "Selects",
        category: "forms",
        min: 10,
        stories: [
            story("default", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
            }),
            story("selected", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                value: "two",
            }),
            story("disabled", Select, {
                label: "Example",
                options: SELECT_OPTIONS,
                disabled: true,
            }),
        ],
    },
    {
        id: "input",
        title: "Inputs",
        category: "forms",
        min: 14,
        stories: [
            story("default", Input, {
                label: "Example",
                placeholder: "Placeholder",
            }),
            story("filled", Input, { label: "Example", value: "Some text" }),
            story("email", Input, {
                label: "Email",
                type: "email",
                placeholder: "you@example.com",
                required: true,
            }),
            story("password", Input, {
                label: "Password",
                type: "password",
                value: "hunter2",
            }),
            story("search", Input, {
                label: "Search",
                type: "search",
                placeholder: "Search…",
            }),
            story("invalid", Input, {
                label: "Example",
                value: "Not quite right",
                "aria-invalid": "true",
            }),
            story("readonly", Input, {
                label: "Example",
                value: "Read only",
                readonly: true,
            }),
            story("disabled", Input, {
                label: "Example",
                placeholder: "Disabled",
                disabled: true,
            }),
        ],
    },
    {
        id: "textarea",
        title: "Textareas",
        category: "forms",
        min: 16,
        stories: [
            story("default", Textarea, {
                label: "Example",
                placeholder: "Write something…",
            }),
            story("filled", Textarea, {
                label: "Example",
                value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
            }),
            story("max-rows", Textarea, {
                label: "Example",
                rows: 2,
                maxRows: 5,
                value: "Grows with its content up to five lines, then scrolls.\nTwo\nThree\nFour\nFive\nSix\nSeven",
            }),
            story("required", Textarea, {
                label: "Example",
                placeholder: "Required, at least 10 characters",
                required: true,
                minlength: 10,
            }),
            story("invalid", Textarea, {
                label: "Example",
                value: "Not quite right",
                "aria-invalid": "true",
            }),
            story("readonly", Textarea, {
                label: "Example",
                value: "Read only",
                readonly: true,
            }),
            story("disabled", Textarea, {
                label: "Example",
                placeholder: "Disabled",
                disabled: true,
            }),
        ],
    },
    {
        id: "segmented-control",
        title: "Segmented controls",
        category: "forms",
        description:
            "Plain radios: they submit with a form and can drive CSS via :has().",
        stories: [
            story("text", SegmentedControl, {
                name: "story-segmented-text",
                label: "View",
                options: VIEW_OPTIONS,
                value: "grid",
            }),
            story("icons", SegmentedControl, {
                name: "story-segmented-icons",
                label: "Alignment",
                options: ALIGN_OPTIONS,
                value: "left",
            }),
            story("small", SegmentedControl, {
                name: "story-segmented-small",
                label: "View",
                options: VIEW_OPTIONS,
                value: "list",
                size: "sm",
            }),
            story("disabled", SegmentedControl, {
                name: "story-segmented-disabled",
                label: "View",
                options: VIEW_OPTIONS,
                value: "grid",
                disabled: true,
            }),
        ],
    },
    {
        id: "swatch-picker",
        title: "Swatch pickers",
        category: "forms",
        description:
            "Colour swatches as plain radios. An option with an accent is a two-colour theme swatch.",
        min: 16,
        stories: [
            story("tones", SwatchPicker, {
                name: "story-swatch-tones",
                label: "Tone",
                options: TONE_SWATCHES,
                value: "primary",
            }),
            story("themes", SwatchPicker, {
                name: "story-swatch-themes",
                label: "Theme",
                options: THEME_SWATCHES,
                value: "nord",
            }),
            story("disabled", SwatchPicker, {
                name: "story-swatch-disabled",
                label: "Tone",
                options: TONE_SWATCHES,
                value: "success",
                disabled: true,
            }),
        ],
    },
    {
        id: "tile-picker",
        title: "Tile pickers",
        category: "forms",
        description:
            "Tiles that share the row, for choosing by look: cards for big previews, one frame for small ones. They're plain radios too.",
        min: 20,
        stories: [
            story(
                "specimens",
                TilePicker,
                { label: "Typeface", style: INSPECTOR_WIDTH },
                { children: specimenTiles("story-tiles-specimens", "soft") },
            ),
            story(
                "sizes",
                TilePicker,
                { label: "Size", style: INSPECTOR_WIDTH },
                { children: boxTiles("story-tiles-sizes", "medium") },
            ),
            story(
                "joined",
                TilePicker,
                { label: "Size", variant: "joined", style: INSPECTOR_WIDTH },
                { children: boxTiles("story-tiles-joined", "medium") },
            ),
            story(
                "small",
                TilePicker,
                { label: "Size", size: "sm", style: INSPECTOR_WIDTH },
                { children: boxTiles("story-tiles-small", "small") },
            ),
            story(
                "disabled",
                TilePicker,
                { label: "Typeface", disabled: true, style: INSPECTOR_WIDTH },
                { children: specimenTiles("story-tiles-disabled", "print") },
            ),
        ],
    },
    {
        id: "tile",
        title: "Tiles",
        category: "forms",
        description:
            "One choice of a tile picker. The caption names it, or the label does when there's none.",
        min: 12,
        stories: [
            story(
                "default",
                Tile,
                { name: "story-tile-default", value: "box", label: "Box" },
                {
                    slot: BOX_PREVIEW,
                },
            ),
            story(
                "checked",
                Tile,
                {
                    name: "story-tile-checked",
                    value: "box",
                    label: "Box",
                    checked: true,
                },
                {
                    slot: BOX_PREVIEW,
                },
            ),
            story(
                "with-caption",
                Tile,
                {
                    name: "story-tile-caption",
                    value: "print",
                    label: "Print",
                    caption: "Print",
                },
                { slot: specimenPreview("Georgia, serif") },
            ),
            story(
                "label-differs",
                Tile,
                {
                    name: "story-tile-differs",
                    value: "print",
                    label: "Serif",
                    caption: "Print",
                },
                { slot: specimenPreview("Georgia, serif") },
            ),
            story(
                "disabled",
                Tile,
                {
                    name: "story-tile-disabled",
                    value: "box",
                    label: "Box",
                    disabled: true,
                },
                { slot: BOX_PREVIEW },
            ),
        ],
    },
    {
        id: "control-row",
        title: "Control rows",
        category: "forms",
        description:
            "A label and a readout on one line, the control below. For inspectors.",
        min: 20,
        stories: [
            story(
                "default",
                ControlRow,
                { label: "variant", mono: true, value: "solid" },
                {
                    children: [
                        story("control", SegmentedControl, {
                            name: "story-row-default",
                            label: "Variant",
                            options: VIEW_OPTIONS,
                            value: "list",
                        }),
                    ],
                },
            ),
            story(
                "with-note",
                ControlRow,
                {
                    label: "size",
                    mono: true,
                    note: "Set by Compare",
                    noteId: "story-row-note",
                    disabled: true,
                },
                {
                    children: [
                        story("control", SegmentedControl, {
                            name: "story-row-note-control",
                            label: "Size",
                            options: VIEW_OPTIONS,
                            value: "grid",
                            disabled: true,
                            "aria-describedby": "story-row-note",
                        }),
                    ],
                },
            ),
            story(
                "with-label-id",
                ControlRow,
                { label: "variant", mono: true, labelId: "story-row-label" },
                {
                    children: [
                        story("control", SegmentedControl, {
                            name: "story-row-labelled",
                            label: "Variant",
                            options: VIEW_OPTIONS,
                            value: "grid",
                            "aria-labelledby": "story-row-label",
                        }),
                    ],
                },
            ),
            story(
                "with-input",
                ControlRow,
                { label: "Label", for: "story-row-input" },
                {
                    children: [
                        story("control", Input, {
                            id: "story-row-input",
                            label: "Label",
                            value: "Save",
                        }),
                    ],
                },
            ),
        ],
    },
];
