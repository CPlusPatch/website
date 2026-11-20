/**
 * Properties left out when baking computed styles: styles.css controls them
 * on extracted elements, which it couldn't do against inline values.
 */
const UNBAKED = new Set([
    "contain",
    "cursor",
    "pointer-events",
    "user-select",
    "-webkit-user-select",
    "transition",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
]);

/**
 * Clones an element for use as a layout placeholder. Media is swapped for an
 * empty box of the same size, so nothing is fetched or played twice.
 */
export const clonePlaceholder = (element: HTMLElement): HTMLElement => {
    if (element.matches("img, video, iframe")) {
        const box = document.createElement("div");
        const styles = getComputedStyle(element);
        for (const property of styles) {
            box.style.setProperty(property, styles.getPropertyValue(property));
        }
        forceSize(
            box,
            Number.parseFloat(styles.width),
            Number.parseFloat(styles.height),
        );
        return box;
    }

    const clone = element.cloneNode(false) as HTMLElement;
    // The original stays on the page, so its id must stay unique
    clone.removeAttribute("id");
    for (const child of element.childNodes) {
        clone.appendChild(
            child instanceof HTMLElement
                ? clonePlaceholder(child)
                : child.cloneNode(true),
        );
    }
    return clone;
};

export const forceSize = (
    element: HTMLElement,
    width: number,
    height: number,
): void => {
    for (const [axis, value] of [
        ["width", width],
        ["height", height],
    ] as const) {
        const px = `${value}px`;
        element.style.setProperty(axis, px);
        element.style.setProperty(`min-${axis}`, px);
        element.style.setProperty(`max-${axis}`, px);
    }

    if (element.style.display === "inline") {
        element.style.display = "inline-block";
    }
};

/**
 * Inlines the computed style of an element and all its descendants, so it
 * keeps its look once moved out of the selectors that styled it.
 */
export const bakeComputedStyles = (root: HTMLElement): void => {
    const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];

    // Every element lists the same properties, so list them once
    const properties = Array.from(getComputedStyle(root)).filter(
        (property) => !UNBAKED.has(property),
    );

    // Read everything before writing anything, to avoid layout thrashing
    const baked = elements.map((element) => {
        const styles = getComputedStyle(element);
        return properties.map(
            (property) =>
                [property, styles.getPropertyValue(property)] as const,
        );
    });

    // One write per element: each setProperty() rewrites the style attribute,
    // which took seconds when baking a whole page
    elements.forEach((element, i) => {
        const declarations = (baked[i] ?? []).map(
            ([property, value]) => `${property}:${value}`,
        );
        element.style.cssText = [...declarations, "contain:layout"].join(";");
    });
};

/** The union of the boxes of the text inside an element, if there is any. */
export const getTextBounds = (element: HTMLElement): DOMRect | null => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null = null;

    while (walker.nextNode()) {
        range.selectNodeContents(walker.currentNode);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        bounds = bounds
            ? {
                  left: Math.min(bounds.left, rect.left),
                  top: Math.min(bounds.top, rect.top),
                  right: Math.max(bounds.right, rect.right),
                  bottom: Math.max(bounds.bottom, rect.bottom),
              }
            : rect;
    }

    return bounds
        ? new DOMRect(
              bounds.left,
              bounds.top,
              bounds.right - bounds.left,
              bounds.bottom - bounds.top,
          )
        : null;
};

/** The sum of the CSS `rotate` of an element and its ancestors, in degrees. */
export const getCumulativeRotation = (element: HTMLElement): number => {
    let degrees = 0;
    for (let el: Element | null = element; el; el = el.parentElement) {
        const rotate = Number.parseFloat(getComputedStyle(el).rotate);
        if (!Number.isNaN(rotate)) degrees += rotate;
    }
    return degrees;
};

/** Whether an element has text directly in it, not only in its children. */
export const hasOwnText = (element: HTMLElement): boolean =>
    Array.from(element.childNodes).some(
        (node) =>
            node.nodeType === Node.TEXT_NODE &&
            Boolean(node.textContent?.trim()),
    );
