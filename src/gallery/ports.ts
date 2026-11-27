/**
 * The Svelte ports that render a controlled story live (see Story.port and
 * playground.svelte). Only Svelte imports, since a client island loads it.
 */

import Badge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import Input from "@cpluspatch/ui/svelte/ui/input.svelte";
import PreviewFrame from "@cpluspatch/ui/svelte/ui/preview-frame.svelte";
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Select from "@cpluspatch/ui/svelte/ui/select.svelte";
import Toggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import type { Component } from "svelte";
import type { PortName } from "./story.ts";

// Each port types its own props, which don't fit a map of any component's.
const port = (component: unknown) =>
    component as Component<Record<string, unknown>>;

export const PORTS: Record<PortName, Component<Record<string, unknown>>> = {
    badge: port(Badge),
    button: port(Button),
    input: port(Input),
    "preview-frame": port(PreviewFrame),
    "segmented-control": port(SegmentedControl),
    select: port(Select),
    toggle: port(Toggle),
};
