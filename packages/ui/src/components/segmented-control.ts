import { type ClassValue, cx } from "../lib/classes.ts";

export type SegmentedSize = "sm" | "default";

export type SegmentedVariant = "solid" | "subtle";

export interface SegmentedOption {
    value: string;
    label: string;
    icon?: string;
    /** Shows the label beside the icon. Without it an icon stands alone, and the label is its title. */
    showLabel?: boolean;
}

export interface SegmentedControlOptions {
    size?: SegmentedSize;
    variant?: SegmentedVariant;
    /** Stretches to the container, the options sharing the width. */
    fill?: boolean;
    class?: ClassValue;
}

/** The classes of a <SegmentedControl>. */
export const segmentedClasses = ({
    size = "default",
    variant = "solid",
    fill = false,
    class: className,
}: SegmentedControlOptions = {}): string[] =>
    cx(
        "segmented",
        `segmented--size-${size}`,
        `segmented--${variant}`,
        fill && "segmented--fill",
        className,
    );
