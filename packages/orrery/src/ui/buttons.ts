import { h } from "@cpluspatch/render";

const SVG = (body: string) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;

export const FOCUS_ICON = SVG(
    '<g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="4"/><path d="M8 0.5V3.5M8 12.5V15.5M0.5 8H3.5M12.5 8H15.5"/></g>',
);

/** A button with `label` that calls `onClick`. */
export const button = (
    label: string,
    className: string,
    onClick: () => void,
): HTMLButtonElement => {
    const control = h("button", { type: "button", class: className }, label);
    control.addEventListener("click", onClick);

    return control;
};

/** A button with an icon and a label in its own span, so changing the label keeps the icon. */
export const iconButton = (
    label: string,
    className: string,
    svg: string,
    onClick: () => void,
): HTMLButtonElement => {
    const control = button("", className, onClick);
    control.innerHTML = svg;
    control.append(h("span", { class: "orrery__orbit-button-label" }, label));

    return control;
};
