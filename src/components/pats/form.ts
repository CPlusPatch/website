import { inbox } from "../../data/home.ts";
import { send } from "../page/inbox/ntfy.ts";

const LINE_LABELS = {
    yes: "Oui",
    no: "Non",
} as const;

/** The text of the ntfy notification for a submitted request. */
const describe = (data: FormData) => {
    const hugged = data.get("calinage") as keyof typeof LINE_LABELS;
    return [
        `Prénom: ${data.get("firstname")}`,
        `Nom: ${data.get("lastname")}`,
        `Câliné·e: ${LINE_LABELS[hugged] ?? ""}`,
        `Qualificateurs: ${data.getAll("qualificateurs").join(", ")}`,
        `Courriel: ${data.get("address")}`,
    ].join("\n");
};

/** Sends the request to the topic, then reloads the page with ?sent=true. */
export const bindPatsForm = (form: HTMLFormElement) => {
    const failed = form.querySelector<HTMLElement>("[data-pats-error]");
    if (!failed) return;

    const setDisabled = (disabled: boolean) => {
        for (const control of form.elements) {
            (control as HTMLInputElement).disabled = disabled;
        }
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        failed.hidden = true;
        // Read before disabling: disabled fields are left out of FormData.
        const body = describe(new FormData(form));
        setDisabled(true);
        try {
            await send(inbox.topic, body, "Notification du Ministere");
            location.assign("/pats?sent=true");
        } catch {
            setDisabled(false);
            failed.hidden = false;
        }
    });
};
