/// <reference types="deno" />

import { assertEquals, assertThrows } from "@std/assert";
import {
    type BenchGroup,
    type BenchStory,
    controlRows,
    firstPick,
    fixedProps,
    liveSource,
    parseHash,
    pickHash,
    pickPath,
    previewOf,
    valuesOf,
} from "./bench.ts";
import type { Control } from "./controls.ts";

const empty: BenchGroup = {
    id: "empty",
    title: "Empty",
    tags: [],
    stories: [],
};

const plain = (name: string): BenchStory => ({
    name,
    tags: [],
    source: "",
    component: "Button",
    controls: [],
});

const variant: BenchStory = {
    name: "default",
    tags: [],
    source: "",
    component: "Button",
    controls: [
        {
            key: "variant",
            kind: "choice",
            values: ["solid", "soft-edge"],
            value: "solid",
        },
        {
            key: "tone",
            kind: "choice",
            values: ["primary", "danger"],
            value: "primary",
        },
    ],
    play: "/gallery/play/button-variant/default/",
    live: { props: { variant: "solid", tone: "primary" }, slot: "Button" },
};

const groups: BenchGroup[] = [
    {
        id: "button-size",
        title: "Size",
        tags: [],
        stories: [plain("sm"), plain("lg")],
    },
    { id: "button-variant", title: "Variant", tags: [], stories: [variant] },
    empty,
];

Deno.test("a story's hash names it, and a group's hash names all its stories", () => {
    assertEquals(
        parseHash(
            groups,
            pickHash({ group: "button-size", story: "lg", query: "" }),
        ),
        { group: "button-size", story: "lg", query: "" },
    );
    assertEquals(parseHash(groups, "#button-size"), {
        group: "button-size",
        story: null,
        query: "",
    });
});

Deno.test("a hash carries the controls' query, and a bad value is dropped", () => {
    const pick = {
        group: "button-variant",
        story: "default",
        query: "variant=soft-edge&tone=danger",
    };

    assertEquals(
        pickHash(pick),
        "#button-variant/default?variant=soft-edge&tone=danger",
    );
    assertEquals(parseHash(groups, pickHash(pick)), pick);
    assertEquals(
        parseHash(
            groups,
            "#button-variant/default?variant=nope&tone=danger&x=1",
        ),
        { group: "button-variant", story: "default", query: "tone=danger" },
    );
    assertEquals(parseHash(groups, "#button-variant/default?variant=solid"), {
        group: "button-variant",
        story: "default",
        query: "",
    });
    assertEquals(parseHash(groups, "#button-size/sm?variant=ghost"), {
        group: "button-size",
        story: "sm",
        query: "",
    });
});

Deno.test("a hash names nothing when its group, story or depth isn't known", () => {
    assertEquals(parseHash(groups, "#nope"), undefined);
    assertEquals(parseHash(groups, "#button-size/xl"), undefined);
    assertEquals(parseHash(groups, "#button-size/sm/extra"), undefined);
    assertEquals(parseHash(groups, "#button-size/sm/extra?a=b"), undefined);
    assertEquals(parseHash(groups, ""), undefined);
});

Deno.test("a malformed hash names nothing instead of throwing", () => {
    assertEquals(parseHash(groups, "#%"), undefined);
});

Deno.test("a pick's page is its story's own, or its group's", () => {
    assertEquals(
        pickPath({ group: "empty", story: null, query: "" }),
        "/gallery/story/empty/",
    );
    assertEquals(
        pickPath({ group: "button-size", story: "sm", query: "" }, plain("sm")),
        "/gallery/story/button-size/sm/",
    );
});

Deno.test("a controlled story's page is its live page, with the query when it has one", () => {
    const pick = { group: "button-variant", story: "default", query: "" };

    assertEquals(
        pickPath(pick, variant),
        "/gallery/play/button-variant/default/",
    );
    assertEquals(
        pickPath({ ...pick, query: "tone=danger" }, variant),
        "/gallery/play/button-variant/default/?tone=danger",
    );
});

Deno.test("a controlled story's source follows the values", () => {
    assertEquals(
        liveSource(variant, valuesOf(variant, "")),
        '<Button variant="solid" tone="primary">Button</Button>',
    );
    assertEquals(
        liveSource(variant, valuesOf(variant, "variant=soft-edge&tone=danger")),
        '<Button variant="soft-edge" tone="danger">Button</Button>',
    );
    assertEquals(liveSource(plain("sm"), {}), "");
});

Deno.test("the live source takes the slot and icon from the values, when controlled", () => {
    const story: BenchStory = {
        ...variant,
        controls: [
            { key: "slot", kind: "text", value: "Button" },
            { key: "icon", kind: "icon", value: "lucide:star" },
        ],
        live: { props: { size: "sm" }, icon: "lucide:star", slot: "Button" },
    };

    assertEquals(
        liveSource(story, valuesOf(story, "slot=Go&icon=")),
        '<Button size="sm">Go</Button>',
    );
    assertEquals(
        liveSource(story, valuesOf(story, "")),
        '<Button size="sm">\n    <Icon name="lucide:star" />\n    Button\n</Button>',
    );
});

Deno.test("the live source leaves off a false boolean and shows a true one bare", () => {
    const story: BenchStory = {
        ...variant,
        controls: [{ key: "disabled", kind: "boolean", value: false }],
        live: { props: { disabled: false }, slot: "Button" },
    };

    assertEquals(
        liveSource(story, valuesOf(story, "")),
        "<Button>Button</Button>",
    );
    assertEquals(
        liveSource(story, valuesOf(story, "disabled=true")),
        "<Button disabled>Button</Button>",
    );
});

Deno.test("the bench opens on the first group's first story, or the group when it has none", () => {
    assertEquals(firstPick(groups), {
        group: "button-size",
        story: "sm",
        query: "",
    });
    assertEquals(firstPick([empty]), {
        group: "empty",
        story: null,
        query: "",
    });
    assertThrows(() => firstPick([]));
});

Deno.test("a story's fixed props are the ones it sets and doesn't control, but not undefined ones", () => {
    const story: BenchStory = {
        ...variant,
        live: {
            props: { variant: "solid", as: "a", href: "#", size: undefined },
        },
    };

    assertEquals(fixedProps(story), ["as", "href"]);
    assertEquals(fixedProps(variant), []);
    assertEquals(fixedProps(plain("sm")), []);
});

Deno.test("an icon and a text control next to each other share a row", () => {
    const choice = variant.controls[0] as Control;
    const icon: Control = { key: "icon", kind: "icon", value: "" };
    const slot: Control = { key: "slot", kind: "text", value: "Go" };
    const label: Control = { key: "label", kind: "text", value: "" };

    assertEquals(controlRows([choice, icon, slot]), [[choice], [icon, slot]]);
    assertEquals(controlRows([slot, icon]), [[slot, icon]]);
    assertEquals(controlRows([icon, choice, slot]), [[icon], [choice], [slot]]);
    assertEquals(controlRows([slot, label]), [[slot], [label]]);
    assertEquals(controlRows([icon, slot, label]), [[icon, slot], [label]]);
    assertEquals(controlRows([]), []);
});

Deno.test("a preview is the port with the story's props and the values on stage, when there is a port", () => {
    const withPort: BenchStory = { ...variant, port: "button" };

    assertEquals(previewOf(withPort, valuesOf(withPort, "tone=danger")), {
        port: "button",
        props: { variant: "solid", tone: "danger" },
    });
    assertEquals(previewOf(variant, {}), undefined);
});
