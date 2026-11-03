import { type ClassValue, cx } from "../lib/classes.ts";

export type AvatarSize = "sm" | "default" | "lg";

export interface AvatarOptions {
    size?: AvatarSize;
    class?: ClassValue;
}

/** The classes of an <Avatar>. */
export const avatarClasses = ({
    size = "default",
    class: className,
}: AvatarOptions = {}): string[] =>
    cx("avatar", `avatar--size-${size}`, className);

/**
 * The letters shown where there is no picture: the first and last word's
 * first letters, so long names don't overflow the box.
 */
export const initials = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);
    return [words[0], words.length > 1 ? words.at(-1) : undefined]
        .map((word) => word?.[0] ?? "")
        .join("")
        .toUpperCase();
};
