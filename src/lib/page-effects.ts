/*
 * Easter eggs that reach the whole page, run by the front page's chat
 * (components/page/dialogue-actions.ts), its terminal (blocks/terminal/) and
 * the gallery's dialogue stories (gallery/dialogue-actions.ts).
 * Browser only: call them from page scripts.
 */
import Uwuifier from "uwuifier";

const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Text the reader never sees as words, and fields they may be typing in. */
const SKIPPED = "script, style, template, textarea, input, svg, code, pre";

/**
 * Rewrites every visible piece of text on the page, and returns a function
 * that puts it all back. Only text nodes change, so markup, links and
 * listeners stay intact. Their surrounding whitespace is kept, as it is
 * layout rather than words.
 */
const rewriteText = (rewrite: (text: string) => string) => {
    const originals = new Map<Text, string>();
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) =>
                node.parentElement?.closest(SKIPPED) || !node.nodeValue?.trim()
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT,
        },
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        const value = text.data;
        const [, before, words, after] =
            value.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? [];
        originals.set(text, value);
        text.data = before + rewrite(words ?? "") + after;
    }
    return () => {
        for (const [text, value] of originals) text.data = value;
    };
};

const uwuifier = new Uwuifier();

/** By length, so a word can be swapped for one about as long. */
const SWEARS: Record<number, string[]> = {
    3: ["ass", "tit", "cum"],
    4: ["shit", "fuck", "damn", "crap", "piss", "dick", "cock", "arse"],
    5: ["bitch", "prick", "balls", "shite", "frick"],
    6: ["bloody", "wanker", "bugger", "asshat", "fucker"],
    7: ["bastard", "jackass", "dumbass", "fuckwit", "shitass"],
    8: ["dickhead", "bullshit", "shithead", "fuckface", "assclown"],
    9: ["shitstorm", "fuckstick", "shitfaced", "douchebag"],
    10: ["cocksucker", "dickweasel", "shitbucket"],
    11: ["clusterfuck", "bullshitter", "fucknugget"],
    12: ["motherfucker"],
};
const lengths = Object.keys(SWEARS).map(Number);

/** A swear about as long as the word, the same one each time for a word. */
const swearFor = (word: string) => {
    const length = lengths.reduce((best, next) =>
        Math.abs(next - word.length) < Math.abs(best - word.length)
            ? next
            : best,
    );
    const choices = SWEARS[length] ?? [];
    let hash = 0;
    for (const char of word.toLowerCase()) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
    }
    const picked = choices[Math.abs(hash) % choices.length] ?? "fuck";
    // Shouted words stay shouted, capitalised ones capitalised.
    if (word.length > 1 && word === word.toUpperCase()) {
        return picked.toUpperCase();
    }
    if (word[0] !== word[0]?.toLowerCase()) {
        return picked[0]?.toUpperCase() + picked.slice(1);
    }
    return picked;
};

/**
 * Violently rattles the page, every way at once, settling as it goes.
 * Each of the body's children shakes, along with anything in the top
 * layer (such as an open chat), which a shaking body would leave still.
 * With reduced motion, it does nothing.
 */
export const shake = async () => {
    if (reducedMotion()) return;
    const steps = 24;
    const keyframes = Array.from({ length: steps + 1 }, (_, step) => {
        const strength = 1 - step / steps;
        const jolt = (max: number) => (Math.random() * 2 - 1) * max * strength;
        return {
            translate: `${jolt(24)}px ${jolt(24)}px`,
            rotate: `${jolt(3)}deg`,
        };
    });
    // A set, as an element can be both.
    const targets = new Set([
        ...document.body.children,
        ...document.querySelectorAll(":popover-open, dialog[open]"),
    ]);
    // Shaken sideways, the page would flash a horizontal scrollbar.
    const root = document.documentElement;
    const overflow = root.style.overflowX;
    root.style.overflowX = "clip";
    await Promise.all(
        [...targets].map(
            (target) => target.animate(keyframes, { duration: 900 }).finished,
        ),
    );
    root.style.overflowX = overflow;
};

/** Uwuifies every text on the page. Returns a function that undoes it. */
export const uwuify = () =>
    rewriteText((text) => uwuifier.uwuifySentence(text));

/**
 * Swaps every word on the page for a swear about as long. Returns a
 * function that undoes it.
 */
export const swear = () =>
    rewriteText((text) => text.replace(/\p{L}+/gu, swearFor));
