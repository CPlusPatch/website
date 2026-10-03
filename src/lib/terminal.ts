export interface Entry {
    command: string;
    output: string;
}
export interface SubmitDetail {
    command: string;
    entries: Entry[];
}
