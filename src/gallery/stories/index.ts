import type { StoryGroup } from "../story.ts";
import { alerts } from "./alerts.ts";
import { avatars } from "./avatars.ts";
import { badges, badges88x31 } from "./badges.ts";
import { buttons } from "./buttons.ts";
import { cards } from "./cards.ts";
import { carousel } from "./carousel.ts";
import { forms } from "./forms.ts";
import { logos } from "./logos.ts";
import { quotes } from "./quotes.ts";
import { sections } from "./sections.ts";
import { terminal } from "./terminal.ts";

/** Every group, in gallery order. */
export const groups: StoryGroup[] = [
    ...buttons,
    ...badges,
    ...avatars,
    ...forms,
    ...badges88x31,
    ...cards,
    ...alerts,
    ...quotes,
    ...sections,
    ...logos,
    ...carousel,
    ...terminal,
];
