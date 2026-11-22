/** An element with the given attributes and children. */
export const h = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Record<string, string> = {},
    ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    element.append(...children);
    return element;
};

/** Sets the text of `node` if it differs, so focus and selection in it survive. */
export const setText = (node: Node, text: string): void => {
    if (node.textContent !== text) node.textContent = text;
};
