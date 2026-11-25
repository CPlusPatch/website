import type { AlertVariant } from "@cpluspatch/ui/components/alert.ts";

/** The kinds of notice. */
export type NoticeVariant = Extract<
    AlertVariant,
    "success" | "warning" | "destructive"
>;

/** How to use the notice area. */
export type Notices = {
    /** Replaces the current notice. It goes away by itself after `clearAfterMs`, if given. */
    show: (variant: NoticeVariant, text: string, clearAfterMs?: number) => void;
    clear: () => void;
};
