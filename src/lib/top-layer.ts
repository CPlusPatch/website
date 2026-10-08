/**
 * Keeps page-wide overlays (scanlines, crosshair) drawn over popovers and
 * modal dialogs. Those render in the browser's top layer, above any
 * z-index, so the only way over them is to join it: each overlay becomes a
 * manual popover, opened at once and reopened whenever anything else opens
 * there, which moves it back to the top.
 *
 * Done from script so that, without JS, the overlays stay ordinary
 * elements: a popover attribute in the markup would hide them until opened.
 * The `.fx-top-layer` rule in utilities.css undoes the popover's default box.
 */

const overlays = new Set<HTMLElement>();

const raise = () => {
    for (const overlay of overlays) {
        if (overlay.matches(":popover-open")) overlay.hidePopover();
        overlay.showPopover();
    }
};

// toggle doesn't bubble, so listen in the capture phase. Fired after the
// change, by popovers and (in current engines) dialogs.
document.addEventListener(
    "toggle",
    (event) => {
        const target = event.target as HTMLElement;
        if (overlays.has(target)) return;
        if ((event as ToggleEvent).newState === "open") raise();
    },
    { capture: true },
);

/** Moves `overlay` into the top layer and keeps it above everything else there. */
export const keepOnTop = (overlay: HTMLElement) => {
    if (!("showPopover" in overlay)) return;
    overlay.popover = "manual";
    overlay.classList.add("fx-top-layer");
    overlays.add(overlay);
    overlay.showPopover();
};
