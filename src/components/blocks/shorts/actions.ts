/**
 * The shorts' actions, which only change the buttons themselves: like and
 * dislike, share, and subscribe. Nothing here touches playback.
 */

const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** The like count under the button, as YouTube shortens it: 48K. */
export const formatLikes = (likes: number) => compact.format(likes);

/** The like button's accessible name, with the count in full. */
export const likesLabel = (likes: number) =>
    `Like, ${likes.toLocaleString("en")} likes`;

const pressed = (button: Element) =>
    button.getAttribute("aria-pressed") === "true";

/**
 * `announce` says what happened where there is nothing to see, like a link
 * copied to the clipboard.
 */
export const bindActions = (
    root: HTMLElement,
    announce: (message: string) => void,
) => {
    for (const short of root.querySelectorAll<HTMLElement>("[data-short]")) {
        const piece = (name: string) =>
            short.querySelector(`[data-short-${name}]`) as HTMLElement;
        const video = short.querySelector("video") as HTMLVideoElement;
        const like = piece("like");
        const dislike = piece("dislike");
        const share = piece("share");

        // Pressing one releases the other.
        const base = Number(like.dataset.count);
        const count = like.querySelector("[data-short-label]") as HTMLElement;
        const press = (button: HTMLElement, other: HTMLElement) => {
            button.setAttribute("aria-pressed", String(!pressed(button)));
            if (pressed(button)) other.setAttribute("aria-pressed", "false");
            const likes = base + Number(pressed(like));
            count.textContent = formatLikes(likes);
            like.setAttribute("aria-label", likesLabel(likes));
        };
        like.addEventListener("click", () => press(like, dislike));
        dislike.addEventListener("click", () => press(dislike, like));

        // The system's share sheet where there is one, otherwise the link
        // is copied, and the button shows a tick for a moment.
        let reset = 0;
        share.addEventListener("click", async () => {
            const url = new URL(video.currentSrc, location.href).href;
            const title = video.getAttribute("aria-label") ?? "";
            try {
                if (navigator.share) {
                    await navigator.share({ title, url });
                    return;
                }
                await navigator.clipboard.writeText(url);
            } catch {
                return;
            }
            share.dataset.done = "";
            announce("Link copied");
            clearTimeout(reset);
            reset = window.setTimeout(() => delete share.dataset.done, 2000);
        });
    }

    // One channel, one subscription, wherever its shorts are in the feed.
    const subscribes = [
        ...root.querySelectorAll<HTMLElement>("[data-short-subscribe]"),
    ];
    for (const button of subscribes) {
        button.addEventListener("click", () => {
            const channel = button.dataset.shortSubscribe;
            const value = String(!pressed(button));
            for (const other of subscribes) {
                if (other.dataset.shortSubscribe === channel)
                    other.setAttribute("aria-pressed", value);
            }
        });
    }
};
