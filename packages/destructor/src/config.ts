export interface DestructorOptions {
    /**
     * The element that toggles the gravity gun. It is styled by the consumer,
     * off the state the gun writes onto it:
     *
     *   aria-pressed   "true" while the gun is equipped.
     *   data-hint      "mouse" or "desktop" after a touch press, until the gun
     *                  is next equipped: the gun needs a mouse.
     *   data-wiggle    set again on every touch press, to restart an animation.
     */
    trigger: HTMLElement;
    /**
     * Thrown elements land on its top edge, or on the bottom of the viewport
     * if that is higher. Without one, the viewport bottom is the ground.
     */
    ground?: Element | null;
    /** Elements that can be picked up. */
    draggable?: string[];
    /** Elements that can never be picked up, even if `draggable` matches. */
    neverDraggable?: string[];
    /** Elements whose hit box is their text, not their whole box. */
    textBounded?: string[];
    /** Elements larger than this are left in place. */
    maxSize?: { width: number; height: number };
    /** Draw the physics bodies, and outline grabbable elements once hovered. */
    debug?: boolean;
}

export type ResolvedOptions = Required<DestructorOptions>;

export const DEFAULT_OPTIONS: Omit<ResolvedOptions, "trigger"> = {
    ground: null,
    draggable: [
        "[data-destructor=grab]",
        "[data-snap]",
        "img",
        "video",
        "h1",
        "h2",
        "h3",
        "p",
        "li",
        "button",
    ],
    neverDraggable: ["[data-destructor=none]", "[data-destructor=none] *"],
    textBounded: ["[data-destructor-bounds=text]", "h1", "h2", "h3", "p"],
    maxSize: { width: 1000, height: 1000 },
    debug: false,
};

/** Classes the simulation puts on page elements; styles.css styles them. */
export const CLASS = {
    container: "destructor-container",
    canvas: "destructor-canvas",
    cursor: "destructor-cursor",
    gun: "destructor-gun",
    element: "destructor-element",
    hover: "destructor-hover",
    extracted: "destructor-extracted",
    placeholder: "destructor-placeholder",
} as const;

/** Attributes the simulation sets on <html>; styles.css keys off them. */
export const ROOT_ATTR = {
    equipped: "data-destructor-equipped",
    /** At least one element has been pulled out of the page. */
    active: "data-destructor-active",
    debug: "data-destructor-debug",
} as const;
