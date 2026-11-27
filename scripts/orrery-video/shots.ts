/**
 * The storyboard. Each shot starts from a fresh page; `setup` isn't filmed, so shots join by
 * hard cuts unless a shot sets `fade`. `cues` run at a time in seconds from the start of the
 * shot; a negative time runs before the cut, unfilmed.
 *
 * @module
 */
import type { Page } from "@playwright/test";
import { type Action, act, drag, key, wheel } from "./actions.ts";
import {
    deselect,
    focus,
    focusSelected,
    pick,
    rate,
    settle,
    turn,
    zoom,
} from "./setup.ts";

export type Shot = {
    id: string;
    seconds: number;
    /** Seconds the previous shot dissolves into this one, taken from both. A hard cut without it. */
    fade?: number;
    setup: (page: Page) => Promise<void>;
    cues: [at: number, action: Action][];
};

/** The music, read from outside the repo. */
export const MUSIC = "/home/jessew/Shine [OVUABkBiRbk].opus";
/** Where in the track the video starts, in seconds. */
export const MUSIC_START = 48.2;

/** The page's clock starts here, so positions and dates are the same on every run. */
export const START = new Date("2026-11-27T12:00:00Z");

/** Close on Saturn from above the ring plane at 1 h/s. */
const nearSaturn = async (page: Page) => {
    await rate(page, 3600);
    await focus(page, "Saturn");
    await zoom(page, -15);
    await turn(page, 0, 120);
    await deselect(page);
    await settle(page, 0.5);
};

/** Notches out from the opening view, which frames the planets out to Mars. */
const ZOOM = 4;

/** The planets out to Jupiter from above. */
const innerSystem = async (page: Page, secondsPerSecond: number) => {
    await rate(page, secondsPerSecond);
    await zoom(page, ZOOM);
    await turn(page, 0, 120);
    await deselect(page);
    await settle(page, 0.5);
};

/** Earth's day side, low over the equator, at 1 min/s. */
const nearEarth = async (page: Page) => {
    await rate(page, 60);
    await focus(page, "Earth");
    await zoom(page, -16);
    await turn(page, 250, -160);
    await deselect(page);
    await settle(page, 0.5);
};

/**
 * `name` in the chase camera at `secondsPerSecond`, `hours` after the start, `notches` in from
 * where the chase camera puts it.
 */
const chase = async (
    page: Page,
    name: string,
    { hours = 0, secondsPerSecond = 60, notches = 0 } = {},
) => {
    await rate(page, 3600);
    await settle(page, hours);
    await rate(page, secondsPerSecond);
    await focus(page, name);
    await page.keyboard.press("c");
    await settle(page, 2);
    await zoom(page, -notches);
    await deselect(page);
    await settle(page, 0.5);
};

/** Moves the camera to another body in one frame, so its card never shows. */
const refocus = (name: string): Action =>
    act(async (page) => {
        await pick(page, name);
        await focusSelected(page);
        await deselect(page);
    });

/** Jupiter with the Galilean moons circling at 1 day/s. */
const nearJupiter = async (page: Page) => {
    await rate(page, 86400);
    await focus(page, "Jupiter");
    await zoom(page, -4);
    await turn(page, -150, 60);
    await deselect(page);
    await settle(page, 0.5);
};

/** Clicks a button on the selected body's card. */
const cardButton = (name: string): Action =>
    act((page) =>
        page
            .getByRole("region", { name: "Selected body" })
            .getByRole("button", { name, exact: true })
            .click(),
    );

/** Types `text` into the focused field, one character a cue apart from `at`. */
const typed = (at: number, text: string): [number, Action][] =>
    [...text].map((char, i) => [at + i * 0.12, key(char)]);

/** The groups in the Satellites menu. */
const GROUPS = 9;

/** Switches every group on in the open Satellites menu, one a cue apart from `at`. */
const allSatellites = (at: number): [number, Action][] =>
    Array.from({ length: GROUPS }, (_, i) => [
        at + i * 0.2,
        act((page) => page.getByRole("menuitemcheckbox").nth(i).click()),
    ]);

/** Loads a built-in scenario through the Scenarios dialog, unfilmed. */
const loadScenario = async (page: Page, name: RegExp) => {
    await page.getByRole("button", { name: "Scenarios" }).click();
    await page.getByRole("button", { name }).click();
    await deselect(page);
    await settle(page, 1);
};

/** A built-in scenario from above at `secondsPerSecond`, `notches` in from where it opens. */
const scenario = async (
    page: Page,
    name: RegExp,
    secondsPerSecond: number,
    notches: number,
) => {
    await loadScenario(page, name);
    await rate(page, secondsPerSecond);
    await turn(page, 0, 100);
    await zoom(page, -notches);
    await deselect(page);
    await settle(page, 0.5);
};

/** A probe in the chase camera at `secondsPerSecond`, from the opening view. */
const chaseProbe = async (
    page: Page,
    name: string,
    secondsPerSecond: number,
) => {
    await rate(page, secondsPerSecond);
    await focus(page, name);
    await page.keyboard.press("c");
    await settle(page, 2);
    await deselect(page);
    await settle(page, 0.5);
};

export const SHOTS: Shot[] = [
    {
        id: "saturn",
        seconds: 5,
        setup: nearSaturn,
        cues: [[-1, drag({ dx: 300, dy: -30, seconds: 7 })]],
    },
    {
        id: "pull-out",
        fade: 0.6,
        seconds: 6,
        setup: nearSaturn,
        // Faster through the empty space between Saturn's moons and the planets.
        cues: [
            [0, wheel({ notches: 16, seconds: 2 })],
            [2, wheel({ notches: 24, seconds: 1.2 })],
            [3.2, wheel({ notches: 14, seconds: 2.8 })],
        ],
    },
    {
        // Speeds up to 1 month/s, runs backwards, then goes live.
        id: "system",
        fade: 0.5,
        seconds: 10,
        setup: (page) => innerSystem(page, 3600),
        cues: [
            [-1, drag({ dx: 220, dy: 45, seconds: 11 })],
            [0.5, key("]")],
            [2, key("]")],
            [3.5, key("]")],
            [6.5, key("r")],
            [9.2, key("l")],
        ],
    },
    {
        id: "earth",
        seconds: 7,
        setup: nearEarth,
        cues: [
            [
                0.4,
                act((page) =>
                    page.getByRole("button", { name: "Satellites" }).click(),
                ),
            ],
            ...allSatellites(0.8),
            [2.8, key("Escape")],
            [2.8, act(deselect)],
            // After the menu, which a held drag would block; the wheel does nothing mid-drag too.
            [2.9, wheel({ notches: 12, seconds: 4.1 })],
        ],
    },
    // Probes in the chase camera, from Earth orbit out to Mars, timed so each is over the day side.
    {
        id: "iss",
        seconds: 5.5,
        setup: (page) => chase(page, "ISS", { hours: 40 / 60, notches: 3 }),
        cues: [[-1, drag({ dx: 120, dy: -15, seconds: 6.5 })]],
    },
    {
        id: "hubble",
        fade: 0.4,
        seconds: 5.5,
        setup: (page) => chase(page, "Hubble", { hours: 45 / 60 }),
        cues: [[-1, drag({ dx: 120, dy: -15, seconds: 6.5 })]],
    },
    {
        id: "mro",
        fade: 0.4,
        seconds: 5.5,
        setup: (page) => chase(page, "MRO", { hours: 35 / 60 }),
        cues: [[-1, drag({ dx: 120, dy: -15, seconds: 6.5 })]],
    },
    // Hope's orbit takes 55 h, so it gets 1 h/s to be seen moving.
    {
        id: "hope",
        fade: 0.4,
        seconds: 5.5,
        setup: (page) =>
            chase(page, "Hope", { hours: 40, secondsPerSecond: 3600 }),
        cues: [[-1, drag({ dx: 120, dy: -15, seconds: 6.5 })]],
    },
    {
        // Parker Solar Probe swings past the Sun at 1 day/s, 2 months on.
        id: "parker",
        seconds: 7,
        setup: async (page) => {
            await chaseProbe(page, "Parker Solar Probe", 604800);
            await settle(page, 7.9);
            await rate(page, 86400);
        },
        cues: [],
    },
    {
        // Mars gets a burn, then time runs up to 1 year/s and back down as it nears a full orbit.
        id: "burn",
        seconds: 10,
        setup: async (page) => {
            await innerSystem(page, 604800);
            await pick(page, "Mars");
            // Blur Search, which `pick` leaves focused.
            await page.evaluate(() =>
                (document.activeElement as HTMLElement | null)?.blur(),
            );
        },
        cues: [
            [0.6, cardButton("Burn")],
            [1.2, key("Control+a")],
            ...typed(1.4, "4000"),
            [3.6, cardButton("Apply")],
            [3.9, act(deselect)],
            [4.0, key("]")],
            [4.6, key("]")],
            [7.9, key("[")],
            [9.2, key("[")],
        ],
    },
    {
        id: "jupiter",
        seconds: 4,
        setup: nearJupiter,
        cues: [[-1, drag({ dx: 160, dy: 0, seconds: 5 })]],
    },
    {
        // The Scenarios dialog, dissolving into Gargantua as if it had been loaded.
        id: "scenarios",
        fade: 0.5,
        seconds: 2.6,
        setup: (page) => innerSystem(page, 86400),
        cues: [
            [
                0.4,
                act((page) =>
                    page.getByRole("button", { name: "Scenarios" }).click(),
                ),
            ],
            [
                1.4,
                act((page) =>
                    page
                        .getByRole("button", { name: /^Load Gargantua/ })
                        .hover(),
                ),
            ],
        ],
    },
    {
        // Miller's planet laps Gargantua every 1.7 h, so every 1.7 s here.
        id: "gargantua",
        fade: 0.5,
        seconds: 5,
        setup: (page) => scenario(page, /^Load Gargantua/, 3600, 10),
        cues: [[-1, drag({ dx: 200, dy: 0, seconds: 6 })]],
    },
    {
        id: "tau-ceti",
        fade: 0.4,
        seconds: 4.5,
        setup: (page) => scenario(page, /^Load Tau Ceti/, 604800, 1),
        cues: [[-1, drag({ dx: 180, dy: 0, seconds: 5.5 })]],
    },
    {
        id: "kerbol",
        fade: 0.4,
        seconds: 5,
        setup: async (page) => {
            await loadScenario(page, /^Load Kerbol/);
            await rate(page, 86400);
        },
        cues: [
            [0.3, refocus("Kerbin")],
            [1.8, drag({ dx: 200, dy: 30, seconds: 3.2 })],
        ],
    },
    {
        id: "ending",
        fade: 0.5,
        seconds: 4,
        setup: (page) => innerSystem(page, 2629800),
        cues: [[0, wheel({ notches: 9, seconds: 4 })]],
    },
];
