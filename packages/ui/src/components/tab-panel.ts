import { type ClassValue, cx } from "../lib/classes.ts";

/** The classes of a <TabPanel>. */
export const tabPanelClasses = (className?: ClassValue): string[] =>
    cx("tab-panel", className);
