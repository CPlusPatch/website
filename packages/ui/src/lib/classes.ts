/** Something a class list can hold: a class, or a falsy value to skip. */
export type ClassValue = string | false | null | undefined;

/**
 * The classes that are set, in order. What the class builders return, for
 * each framework to join its own way (Astro's `class:list`, Vue's `:class`,
 * Svelte's `class`).
 */
export const cx = (...values: ClassValue[]): string[] =>
    values.filter((value): value is string => Boolean(value));
