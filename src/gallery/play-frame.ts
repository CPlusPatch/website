/**
 * How the bench changes a play page's props without reloading its frame
 * (see playground.svelte): it posts the new query, and the page says when
 * it's ready to take one.
 */

export type PlayMessage = { type: "gallery-play"; query: string };

const READY = "gallery-play-ready";

export const playMessage = (query: string): PlayMessage => ({
    type: "gallery-play",
    query,
});

export const isPlayMessage = (data: unknown): data is PlayMessage =>
    typeof data === "object" &&
    data !== null &&
    (data as PlayMessage).type === "gallery-play" &&
    typeof (data as PlayMessage).query === "string";

export const isReadyMessage = (data: unknown): boolean =>
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === READY;

/** The ready message a play page posts to the page around it. */
export const readyMessage = () => ({ type: READY });

/** A page's URL as its path and its query, without the `?`. */
export const splitUrl = (url: string): { path: string; query: string } => {
    const at = url.indexOf("?");

    return at < 0
        ? { path: url, query: "" }
        : { path: url.slice(0, at), query: url.slice(at + 1) };
};

/** Sends a frame's play page a query. A page that isn't one ignores it. */
export const sendQuery = (frame: HTMLIFrameElement, query: string): void =>
    frame.contentWindow?.postMessage(playMessage(query), location.origin);

/**
 * Keeps sending a frame the query `current()` gives, whenever its page loads
 * or says it's ready: a message sent earlier would be lost on a page that
 * hasn't started yet. Returns what stops it.
 */
export const followQuery = (
    frame: HTMLIFrameElement,
    current: () => string,
): (() => void) => {
    const send = () => sendQuery(frame, current());
    const onMessage = (event: MessageEvent) => {
        if (
            event.origin === location.origin &&
            event.source === frame.contentWindow &&
            isReadyMessage(event.data)
        ) {
            send();
        }
    };

    window.addEventListener("message", onMessage);
    frame.addEventListener("load", send);

    return () => {
        window.removeEventListener("message", onMessage);
        frame.removeEventListener("load", send);
    };
};
