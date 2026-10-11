/*
 * The actions the front page's chat runs (see the `chat` tree in
 * data/home.ts). The text ones last until the reader starts over.
 */
import { shake, swear, uwuify } from "../../lib/page-effects.ts";
import {
    type DialogueAction,
    defineDialogueActions,
} from "../blocks/message/dialogue.ts";

/**
 * Opens the Shorts easter egg (doomscroll.astro). Opening it closes the
 * chat's window, so the chat waits for it to close, then opens again to
 * carry on, unless the reader has opened it already.
 *
 * Its own button opens it again, as the window is placed by the button
 * that opened it (anchor positioning), and without one it would sit in the
 * page's top corner.
 */
const doomscroll: DialogueAction = ({ root }) =>
    new Promise<void>((done) => {
        const shorts = document.querySelector<HTMLElement>("#doomscroll");
        if (!shorts) return done();
        const closed = (event: Event) => {
            if ((event as ToggleEvent).newState !== "closed") return;
            shorts.removeEventListener("toggle", closed);
            const chat = root.closest<HTMLElement>("[popover]");
            if (chat && !chat.matches(":popover-open")) {
                const button = document.querySelector<HTMLElement>(
                    `[popovertarget="${chat.id}"]:not([popovertargetaction="hide"])`,
                );
                if (button) button.click();
                else chat.showPopover();
            }
            done();
        };
        shorts.addEventListener("toggle", closed);
        shorts.showPopover();
    });

defineDialogueActions({ shake, uwuify, swear, doomscroll });
