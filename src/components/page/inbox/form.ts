import type { Feed } from "./feed.ts";
import { SendError, send } from "./ntfy.ts";

/** Wires up the inbox form: sends on submit, then reports how it went. */
export const bindInboxForm = (form: HTMLFormElement, feed?: Feed) => {
    const author = form.elements.namedItem("author") as HTMLInputElement;
    const message = form.elements.namedItem("message") as HTMLTextAreaElement;
    const submit = form.querySelector<HTMLButtonElement>("[type=submit]");
    const ok = form.querySelector<HTMLElement>("[data-inbox-ok]");
    const failed = form.querySelector<HTMLElement>("[data-inbox-error]");
    const reason = form.querySelector<HTMLElement>("[data-inbox-reason]");
    const count = form.querySelector<HTMLElement>("[data-inbox-count]");
    if (!submit || !ok || !failed || !reason) return;

    form.hidden = false;

    const updateCount = () => {
        if (count) count.textContent = String(message.value.length);
    };
    message.addEventListener("input", updateCount);
    message.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = message.value.trim();
        if (!text) return;

        submit.disabled = true;
        ok.hidden = failed.hidden = true;
        try {
            const sent = await send(
                form.dataset.topic ?? "",
                text,
                author.value.trim() || "Anonymous",
            );
            form.reset();
            updateCount();
            ok.hidden = false;
            feed?.add(sent, true);
        } catch (error) {
            reason.textContent =
                error instanceof SendError && error.status === 429
                    ? "You're sending too fast. Give it a minute and try again."
                    : "Couldn't send your message. Your text is still here, so try again.";
            failed.hidden = false;
        } finally {
            submit.disabled = false;
        }
    });
};
