import { type ClassValue, cx } from "../lib/classes.ts";

export interface TabItem {
    value: string;
    label: string;
    /** Adds a dot after the label, and "(changed)" for screen readers. */
    changed?: boolean;
}

/** The classes of a <TabList>. */
export const tabListClasses = (className?: ClassValue): string[] =>
    cx("tab-list", className);

/** The id of a tab: the panel's `aria-labelledby` points at it. */
export const tabId = (id: string, value: string): string =>
    `${id}-tab-${value}`;

/** The id of a tab's panel: the tab's `aria-controls` points at it. */
export const tabPanelId = (id: string, value: string): string =>
    `${id}-panel-${value}`;
