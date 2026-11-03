import { type ClassValue, cx } from "../lib/classes.ts";

export type SegmentedSize = "sm" | "default";

export type SegmentedVariant = "solid" | "subtle";

export interface SegmentedOption {
    value: string;
    label: string;
    icon?: string;
}

export interface SegmentedControlOptions {
    size?: SegmentedSize;
    variant?: SegmentedVariant;
    class?: ClassValue;
}

/** The classes of a <SegmentedControl>. */
export const segmentedClasses = ({
    size = "default",
    variant = "solid",
    class: className,
}: SegmentedControlOptions = {}): string[] =>
    cx(
        "segmented",
        `segmented--size-${size}`,
        `segmented--${variant}`,
        className,
    );
