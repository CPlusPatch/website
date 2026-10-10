/*
 * The actions the front page's chat runs (see the `chat` tree in
 * data/home.ts). The text ones last until the reader starts over.
 */
import { shake, swear, uwuify } from "../../lib/page-effects.ts";
import { defineDialogueActions } from "../blocks/message/dialogue.ts";

defineDialogueActions({ shake, uwuify, swear });
