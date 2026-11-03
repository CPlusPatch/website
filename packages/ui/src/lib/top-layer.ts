/**
 * Keeps page-wide overlays (scanlines) drawn over popovers and
 * modal dialogs. Those render in the browser's top layer, above any
 * z-index, so the only way over them is to join it: each overlay becomes a
 * manual popover, opened at once and reopened whenever anything else opens
 * there, which moves it back to the top.
 *
 * Done from script so that, without JS, the overlays stay ordinary
 * elements: a popover attribute in the markup would hide them until opened.
 * The `.fx-top-layer` rule in styles/utilities.css undoes the popover's
 * default box.
 *
 * Importing this does nothing: the document listener is added by the first
 * keepOnTop() and removed with the last cleanup.
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
const onToggle = (event: Event) => {
    const target = event.target as HTMLElement;
    if (overlays.has(target)) return;
    if ((event as ToggleEvent).newState === "open") raise();
};

/**
 * Moves `overlay` into the top layer and keeps it above everything else
 * there. Returns a function that puts it back as an ordinary element.
 */
export const keepOnTop = (overlay: HTMLElement): (() => void) => {
    if (!("showPopover" in overlay)) return () => {};
    overlay.popover = "manual";
    overlay.classList.add("fx-top-layer");
    if (!overlays.size) {
        document.addEventListener("toggle", onToggle, { capture: true });
    }
    overlays.add(overlay);
    overlay.showPopover();

    return () => {
        if (!overlays.delete(overlay)) return;
        if (overlay.matches(":popover-open")) overlay.hidePopover();
        overlay.removeAttribute("popover");
        overlay.classList.remove("fx-top-layer");
        if (!overlays.size) {
            document.removeEventListener("toggle", onToggle, {
                capture: true,
            });
        }
    };
};
