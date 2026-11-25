import { h } from "@cpluspatch/render";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";

// Lucide's triangle-alert (ISC); @cpluspatch/ui only ships the icons its components draw.
const TRIANGLE_ALERT =
    '<svg class="icon" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"/></svg>';

/** A hidden warning alert and the element to put its text in. */
export const createWarning = (): {
    element: HTMLElement;
    text: HTMLElement;
} => {
    const text = h("span");
    const element = h(
        "div",
        {
            class: `${alertClasses({ variant: "warning", icon: true }).join(" ")} orrery__warning`,
            role: "status",
        },
        h(
            "div",
            { class: "content" },
            h(
                "p",
                {},
                h(
                    "span",
                    { class: "visually-hidden" },
                    alertPrefix("warning") ?? "",
                ),
                " ",
                text,
            ),
        ),
    );
    element.insertAdjacentHTML("afterbegin", TRIANGLE_ALERT);
    element.hidden = true;

    return { element, text };
};
