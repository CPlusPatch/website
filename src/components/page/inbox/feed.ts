import { motion } from "../../../lib/motion.ts";
import type { NtfyMessage } from "./ntfy.ts";

export interface Feed {
    /** Adds a message, once: `mine` puts it on the sender's side, as theirs. */
    add: (data: NtfyMessage, mine?: boolean) => void;
}

type State = "connecting" | "live" | "reconnecting" | "offline";

/** Failed attempts in a row before the feed says it is offline. */
const OFFLINE_AFTER = 3;
const RETRY_MIN = 5000;
const RETRY_MAX = 60000;

/**
 * Follows the topic's event stream and lists each message, cloned from the
 * templates (one per side). Messages are anyone's, so their text only ever
 * goes in as textContent.
 */
export const bindInboxFeed = (root: HTMLElement): Feed | undefined => {
    const list = root.querySelector<HTMLElement>("[data-inbox-list]");
    const empty = root.querySelector<HTMLElement>("[data-inbox-empty]");
    const templates = {
        start: root.querySelector<HTMLTemplateElement>("[data-side=start]"),
        end: root.querySelector<HTMLTemplateElement>("[data-side=end]"),
    };
    const states = root.querySelectorAll<HTMLElement>("[data-inbox-state]");
    const offlineNote = root.querySelector<HTMLElement>("[data-inbox-offline]");
    const waitingNote = root.querySelector<HTMLElement>("[data-inbox-waiting]");
    const topic = root.dataset.topic;
    if (!list || !empty || !templates.start || !templates.end || !topic) return;

    const shown = new Map<string, { element: Element; mine: boolean }>();

    const render = (
        { id, time, title, message }: NtfyMessage,
        mine: boolean,
    ) => {
        const template = templates[mine ? "end" : "start"];
        const item = template?.content.cloneNode(true) as DocumentFragment;
        const author = item.querySelector(".message__author");
        const clock = item.querySelector("time");
        const body = item.querySelector("[data-inbox-body]");
        const element = item.firstElementChild;
        if (!author || !clock || !body || !element) return;

        const sent = new Date(time * 1000);
        author.textContent = title || "Anonymous";
        clock.textContent = sent.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
        clock.dateTime = sent.toISOString();
        body.textContent = message;
        return { element, mine, id };
    };

    const add = (data: NtfyMessage, mine = false) => {
        const known = shown.get(data.id);
        // The stream can deliver a message before its sender's request
        // returns; it is theirs, so move it over.
        if (known && (known.mine || !mine)) return;

        const rendered = render(data, mine);
        if (!rendered) return;

        if (known) known.element.replaceWith(rendered.element);
        else list.append(rendered.element);
        shown.set(data.id, rendered);

        empty.hidden = true;
        list.hidden = false;
        list.scrollTo({ top: list.scrollHeight, behavior: motion() });
    };

    const show = (state: State) => {
        for (const element of states) {
            element.hidden = element.dataset.inboxState !== state;
        }
        if (offlineNote) offlineNote.hidden = state !== "offline";
        if (waitingNote) waitingNote.hidden = state === "offline";
    };

    let events: EventSource | undefined;
    let failures = 0;

    const connect = () => {
        if (failures === 0) show("connecting");
        events = new EventSource(`${topic}/sse`);
        events.addEventListener("open", () => {
            failures = 0;
            show("live");
        });
        events.addEventListener("error", () => {
            failures++;
            show(failures >= OFFLINE_AFTER ? "offline" : "reconnecting");
            // The browser retries on its own unless the server refused, in
            // which case we do, less often the longer it keeps failing.
            if (events?.readyState === EventSource.CLOSED) {
                setTimeout(
                    connect,
                    Math.min(RETRY_MIN * 2 ** (failures - 1), RETRY_MAX),
                );
            }
        });
        events.addEventListener("message", (event) => {
            try {
                add(JSON.parse((event as MessageEvent<string>).data));
            } catch {
                // Not one of ours
            }
        });
    };

    // Closed when the page is left, and reopened if it comes back from the
    // back/forward cache; messages sent meanwhile are lost, as ever.
    addEventListener("pagehide", () => events?.close());
    addEventListener("pageshow", (event) => {
        if (event.persisted) connect();
    });
    connect();

    return { add };
};
