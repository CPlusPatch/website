/** What the status line shows: nothing, a message, or the errors of an invalid file. */
export type Status = string | { invalid: string[] } | null;
