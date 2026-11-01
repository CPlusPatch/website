/** Talking to the ntfy topic behind the inbox (see inbox in data/home.ts). */

export interface NtfyMessage {
    id: string;
    /** Epoch seconds. */
    time: number;
    message: string;
    /** The sender, from the Title header. */
    title?: string;
}

/** A refused message, with the HTTP status it was refused with. */
export class SendError extends Error {
    constructor(readonly status: number) {
        super(`ntfy ${status}`);
    }
}

/** A header value ntfy can read: non-ASCII text goes as RFC 2047 base64. */
const headerValue = (text: string) => {
    if (/^[\x20-\x7e]*$/.test(text)) return text;
    const bytes = new TextEncoder().encode(text);
    return `=?UTF-8?B?${btoa(String.fromCharCode(...bytes))}?=`;
};

/** Sends a message to the topic, throwing a SendError if it is refused. */
export const send = async (
    topic: string,
    message: string,
    author: string,
): Promise<NtfyMessage> => {
    const response = await fetch(topic, {
        method: "PUT",
        headers: { Title: headerValue(author) },
        body: message,
    });
    if (!response.ok) {
        console.error(`ntfy ${response.status}:`, await response.text());
        throw new SendError(response.status);
    }
    return response.json();
};
