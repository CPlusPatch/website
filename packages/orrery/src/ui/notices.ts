import { h } from "@cpluspatch/render";
import { iconSvg } from "@cpluspatch/ui";
import {
    type AlertVariant,
    alertClasses,
    alertPrefix,
} from "@cpluspatch/ui/components/alert.ts";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";

/** The kinds of notice. */
export type NoticeVariant = Extract<
    AlertVariant,
    "success" | "warning" | "destructive"
>;

/** The notice area's element and how to use it. */
export type Notices = {
    element: HTMLElement;
    /**
     * Replaces the current notice. A string becomes a paragraph, and nodes go in
     * as they are. It goes away by itself after `clearAfterMs`, if given.
     */
    show: (
        variant: NoticeVariant,
        content: string | Node[],
        clearAfterMs?: number,
    ) => void;
    clear: () => void;
    destroy: () => void;
};

/**
 * A place for one dismissible alert at a time. It's a live region from the
 * start, as one added with its content isn't announced. Dismissing a notice
 * with the keyboard moves focus to the Scenario menu's button in `root`.
 */
export const createNotices = (root: ParentNode): Notices => {
    const element = h("div", {
        class: "orrery__notices",
        role: "status",
        "aria-live": "polite",
    });
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
        clearTimeout(timer);
        element.replaceChildren();
    };

    const show: Notices["show"] = (variant, content, clearAfterMs) => {
        clear();

        const dismiss = h("button", {
            type: "button",
            class: buttonClasses({
                variant: "ghost",
                tone: "neutral",
                size: "icon-sm",
            }).join(" "),
            "aria-label": "Dismiss",
        });
        dismiss.innerHTML = iconSvg("x");
        dismiss.addEventListener("click", () => {
            const hadFocus = document.activeElement === dismiss;

            clear();
            if (hadFocus) {
                root.querySelector<HTMLElement>(
                    "[popovertarget=scenario]",
                )?.focus();
            }
        });

        const prefix = h(
            "span",
            { class: "visually-hidden" },
            alertPrefix(variant) ?? "",
        );
        const body =
            typeof content === "string"
                ? [h("p", {}, prefix, ` ${content}`)]
                : [prefix, ...content];

        element.append(
            h(
                "div",
                {
                    class: `${alertClasses({ variant }).join(" ")} orrery__alert`,
                    // Success is news, so the live region covers it.
                    ...(variant === "success" ? {} : { role: "alert" }),
                },
                h("div", { class: "content" }, ...body),
                dismiss,
            ),
        );

        if (clearAfterMs !== undefined) timer = setTimeout(clear, clearAfterMs);
    };

    return {
        element,
        show,
        clear,
        destroy: () => {
            clear();
            element.remove();
        },
    };
};
