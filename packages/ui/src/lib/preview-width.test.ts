/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import {
    isFill,
    keyWidth,
    page,
    parseWidth,
    snap,
    widthText,
} from "./preview-width.ts";

const WIDTHS = [
    { name: "Tablet", rem: 48 },
    { name: "Phone", rem: 32 },
    { name: "Tiny", rem: 24 },
];

Deno.test("a width within half a rem of a snap width lands on it", () => {
    assertEquals(snap(32.4, WIDTHS, 20, 61), 32);
    assertEquals(snap(31.5, WIDTHS, 20, 61), 32);
    assertEquals(snap(47.6, WIDTHS, 20, 61), 48);
});

Deno.test("a width further than half a rem from every snap width stays", () => {
    assertEquals(snap(32.6, WIDTHS, 20, 61), 32.6);
    assertEquals(snap(40, WIDTHS, 20, 61), 40);
    assertEquals(snap(40, [], 20, 61), 40);
});

Deno.test("snapping takes the nearer of two snap widths", () => {
    const close = [
        { name: "A", rem: 30 },
        { name: "B", rem: 30.6 },
    ];
    assertEquals(snap(30.4, close, 20, 61), 30.6);
    assertEquals(snap(30.1, close, 20, 61), 30);
});

Deno.test("a snap width outside the range isn't a target", () => {
    assertEquals(snap(24.2, WIDTHS, 25, 61), 24.2);
    assertEquals(snap(47.9, WIDTHS, 20, 40), 47.9);
});

Deno.test("PageUp goes to the next snap width, then fill", () => {
    assertEquals(page(20, 1, WIDTHS, 20, 61), 24);
    assertEquals(page(24, 1, WIDTHS, 20, 61), 32);
    assertEquals(page(30, 1, WIDTHS, 20, 61), 32);
    assertEquals(page(48, 1, WIDTHS, 20, 61), 61);
    assertEquals(page(61, 1, WIDTHS, 20, 61), 61);
});

Deno.test("PageDown goes to the previous snap width, then min", () => {
    assertEquals(page(61, -1, WIDTHS, 20, 61), 48);
    assertEquals(page(48, -1, WIDTHS, 20, 61), 32);
    assertEquals(page(40, -1, WIDTHS, 20, 61), 32);
    assertEquals(page(24, -1, WIDTHS, 20, 61), 20);
    assertEquals(page(20, -1, WIDTHS, 20, 61), 20);
});

Deno.test("paging skips snap widths outside the range, and works without any", () => {
    assertEquals(page(30, 1, WIDTHS, 20, 40), 32);
    assertEquals(page(32, 1, WIDTHS, 20, 40), 40);
    assertEquals(page(30, -1, WIDTHS, 28, 61), 28);
    assertEquals(page(30, 1, [], 20, 61), 61);
    assertEquals(page(30, -1, [], 20, 61), 20);
});

Deno.test("arrow keys move a rem and clamp to min and max", () => {
    assertEquals(keyWidth("ArrowRight", 30, WIDTHS, 20, 61), 31);
    assertEquals(keyWidth("ArrowUp", 30, WIDTHS, 20, 61), 31);
    assertEquals(keyWidth("ArrowLeft", 30, WIDTHS, 20, 61), 29);
    assertEquals(keyWidth("ArrowDown", 30, WIDTHS, 20, 61), 29);
    assertEquals(keyWidth("ArrowLeft", 20.4, WIDTHS, 20, 61), 20);
    assertEquals(keyWidth("ArrowRight", 60.5, WIDTHS, 20, 61), 61);
});

Deno.test("PageUp and PageDown page, and other keys are left alone", () => {
    assertEquals(keyWidth("PageUp", 30, WIDTHS, 20, 61), 32);
    assertEquals(keyWidth("PageDown", 30, WIDTHS, 20, 61), 24);
    assertEquals(keyWidth("Home", 30, WIDTHS, 20, 61), undefined);
    assertEquals(keyWidth("End", 30, WIDTHS, 20, 61), undefined);
    assertEquals(keyWidth("a", 30, WIDTHS, 20, 61), undefined);
});

Deno.test("a width within a quarter rem of the container's is fill", () => {
    assertEquals(isFill(61, 61), true);
    assertEquals(isFill(60.75, 61), true);
    assertEquals(isFill(60.7, 61), false);
});

Deno.test("the width's text, to one decimal, names a snap width or fill", () => {
    assertEquals(widthText(32, WIDTHS, 61), "32 rem, Phone");
    assertEquals(widthText(61, WIDTHS, 61), "Fill, 61 rem");
    assertEquals(widthText(27, WIDTHS, 61), "27 rem");
    assertEquals(widthText(27.4, WIDTHS, 61), "27.4 rem");
    assertEquals(widthText(23.625, WIDTHS, 23.625), "Fill, 23.6 rem");
    assertEquals(widthText(48, WIDTHS, 48), "Fill, 48 rem");
});

Deno.test("a stored width is a positive number or fill", () => {
    assertEquals(parseWidth("fill"), "fill");
    assertEquals(parseWidth("32"), 32);
    assertEquals(parseWidth("27.5"), 27.5);
    assertEquals(parseWidth(null), undefined);
    assertEquals(parseWidth(""), undefined);
    assertEquals(parseWidth("wide"), undefined);
    assertEquals(parseWidth("-4"), undefined);
});
