/**
 * The Svelte ports that render a controlled story live (see Story.port and
 * playground.svelte). Only Svelte imports, since a client island loads it.
 */

import Badge from "@cpluspatch/ui/svelte/ui/badge.svelte";
import Button from "@cpluspatch/ui/svelte/ui/button.svelte";
import Combobox from "@cpluspatch/ui/svelte/ui/combobox.svelte";
import ControlRow from "@cpluspatch/ui/svelte/ui/control-row.svelte";
import Input from "@cpluspatch/ui/svelte/ui/input.svelte";
import PreviewFrame from "@cpluspatch/ui/svelte/ui/preview-frame.svelte";
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import Select from "@cpluspatch/ui/svelte/ui/select.svelte";
import SwatchPicker from "@cpluspatch/ui/svelte/ui/swatch-picker.svelte";
import TabList from "@cpluspatch/ui/svelte/ui/tab-list.svelte";
import TabPanel from "@cpluspatch/ui/svelte/ui/tab-panel.svelte";
import Tile from "@cpluspatch/ui/svelte/ui/tile.svelte";
import TilePicker from "@cpluspatch/ui/svelte/ui/tile-picker.svelte";
import Toggle from "@cpluspatch/ui/svelte/ui/toggle.svelte";
import type { Component } from "svelte";
import type { PortName } from "./story.ts";

// Each port types its own props, which don't fit a map of any component's.
const port = (component: unknown) =>
    component as Component<Record<string, unknown>>;

export const PORTS: Record<PortName, Component<Record<string, unknown>>> = {
    badge: port(Badge),
    button: port(Button),
    combobox: port(Combobox),
    "control-row": port(ControlRow),
    input: port(Input),
    "preview-frame": port(PreviewFrame),
    "segmented-control": port(SegmentedControl),
    select: port(Select),
    "swatch-picker": port(SwatchPicker),
    "tab-list": port(TabList),
    "tab-panel": port(TabPanel),
    tile: port(Tile),
    "tile-picker": port(TilePicker),
    toggle: port(Toggle),
};
