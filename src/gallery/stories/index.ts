import { CATEGORIES, type StoryGroup } from "../story.ts";
import { accordion } from "./accordion.ts";
import { alerts } from "./alerts.ts";
import { attachments } from "./attachments.ts";
import { audioPlayer } from "./audio-player.ts";
import { avatars } from "./avatars.ts";
import { badges, badges88x31 } from "./badges.ts";
import { buttons } from "./buttons.ts";
import { cards } from "./cards.ts";
import { carousel } from "./carousel.ts";
import { code } from "./code.ts";
import { destructor } from "./destructor.ts";
import { dropdowns } from "./dropdowns.ts";
import { figures } from "./figures.ts";
import { forms } from "./forms.ts";
import { logos } from "./logos.ts";
import { mediaPlayer } from "./media-player.ts";
import { messages } from "./messages.ts";
import { quotes } from "./quotes.ts";
import { sections } from "./sections.ts";
import { stats } from "./stats.ts";
import { terminal } from "./terminal.ts";

/** Every group. Within a category, groups keep this order. */
export const groups: StoryGroup[] = [
    ...buttons,
    ...badges,
    ...avatars,
    ...alerts,
    ...cards,
    ...attachments,
    ...messages,
    ...dropdowns,
    ...forms,
    ...quotes,
    ...figures,
    ...stats,
    ...accordion,
    ...logos,
    ...badges88x31,
    ...carousel,
    ...terminal,
    ...code,
    ...destructor,
    ...audioPlayer,
    ...mediaPlayer,
    ...sections,
];

/** The groups sorted into categories, in gallery order. */
export const categories = CATEGORIES.map((category) => ({
    ...category,
    groups: groups.filter((group) => group.category === category.id),
}));
