/**
 * Every behaviour, and `initAll` to run them all. Prefer importing the ones
 * you use from `@cpluspatch/ui/behaviours/<name>.ts`: `initAll` pulls every
 * behaviour into the page, which is for apps that render components from
 * anywhere (and for testing), not for pages that use two of them.
 *
 * Each `initX(root)` binds one element and returns a function that undoes it;
 * each `initXs(scope)` binds every match inside `scope` and returns one
 * function for all of them. Binding twice is a no-op. The JSDoc at the top of
 * each module says what markup it expects.
 */
import { initAudioPlayers } from "./audio-player.ts";
import { initCarousels } from "./carousel.ts";
import { initCodes } from "./code.ts";
import { initDisplayMenus } from "./display-menu.ts";
import { initDropdowns } from "./dropdown.ts";
import { initHeatmaps } from "./heatmap.ts";
import { initInteractiveMessages } from "./interactive-message.ts";
import { initKbds } from "./kbd.ts";
import { initMarquees } from "./marquee.ts";
import { initMediaPlayers } from "./media-player.ts";
import { initNavbars } from "./navbar.ts";
import { initPauseButtons } from "./pause-button.ts";
import { initScrollCues } from "./scroll-cue.ts";
import { initSidebarNavs } from "./sidebar-nav.ts";
import { initStats } from "./stat.ts";

export { initAudioPlayer, initAudioPlayers } from "./audio-player.ts";
export type { Behaviour } from "./behaviour.ts";
export { behaviour } from "./behaviour.ts";
export { initCarousel, initCarousels } from "./carousel.ts";
export { initCode, initCodes } from "./code.ts";
export { initDisplayMenu, initDisplayMenus } from "./display-menu.ts";
export { initDropdown, initDropdowns } from "./dropdown.ts";
export { initHeatmap, initHeatmaps } from "./heatmap.ts";
export type {
    DialogueAction,
    DialogueNode,
    DialogueOption,
    InteractiveMessageOptions,
} from "./interactive-message.ts";
export {
    defineDialogueActions,
    initInteractiveMessage,
    initInteractiveMessages,
} from "./interactive-message.ts";
export { initKbd, initKbds } from "./kbd.ts";
export { initMarquee, initMarquees } from "./marquee.ts";
export { initMediaPlayer, initMediaPlayers } from "./media-player.ts";
export { initNavbar, initNavbars } from "./navbar.ts";
export {
    initPauseButton,
    initPauseButtons,
    playWhileVisible,
    setPaused,
} from "./pause-button.ts";
export { initScrollCue, initScrollCues } from "./scroll-cue.ts";
export { initSidebarNav, initSidebarNavs } from "./sidebar-nav.ts";
export { initStat, initStats } from "./stat.ts";
export type {
    Program,
    TerminalOptions,
    TerminalResult,
} from "./terminal.ts";
export { CLEAR, initTerminal, initTerminals } from "./terminal.ts";

/**
 * Binds every behaviour that needs nothing but markup, to what is inside
 * `scope`, and returns a function that undoes them all. Not the terminal,
 * which needs a `run` option: call `initTerminals(scope, { run })`.
 */
export const initAll = (scope: ParentNode = document): (() => void) => {
    const cleanups = [
        initAudioPlayers,
        initCarousels,
        initCodes,
        initDisplayMenus,
        initDropdowns,
        initHeatmaps,
        initInteractiveMessages,
        initKbds,
        initMarquees,
        initMediaPlayers,
        initNavbars,
        initPauseButtons,
        initScrollCues,
        initSidebarNavs,
        initStats,
    ].map((init) => init(scope));
    return () => {
        for (const cleanup of cleanups) cleanup();
    };
};
