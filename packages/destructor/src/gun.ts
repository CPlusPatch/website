import { CLASS, ROOT_ATTR } from "./config.ts";
import type { Destructor } from "./destructor.ts";
import type { PhysicsElement } from "./element.ts";
import { grab, mouseHandlers } from "./matter.ts";

/** Below this viewport width a touch press suggests a desktop, not a mouse. */
const NARROW_VIEWPORT = 700;

/** Debounce on the claws-close sound, in ms. */
const CLOSE_DEBOUNCE = 200;

/** How long after a touch a click still counts as that touch, in ms. */
const TOUCH_CLICK_WINDOW = 1000;

/**
 * When the page was last touched, from performance.now(). Tracked from the
 * moment this module loads, rather than from when the gun is created, so the
 * press that creates the simulation is classified too.
 */
let touchedAt = Number.NEGATIVE_INFINITY;
document.addEventListener(
    "touchstart",
    () => {
        touchedAt = performance.now();
    },
    { capture: true, passive: true },
);

/** Re-adds an attribute so a CSS animation keyed off it plays again. */
const restartAnimation = (element: HTMLElement, attribute: string): void => {
    element.removeAttribute(attribute);
    void element.offsetWidth; // Force a style flush between the two
    element.setAttribute(attribute, "");
};

/** The gravity gun: the trigger, the cursor sprite and picking things up. */
export class GravityGun {
    private readonly cursor: HTMLDivElement;
    private readonly sprite: HTMLDivElement;
    private readonly trigger: HTMLElement;

    private equipped = false;
    private held: PhysicsElement | null = null;
    private hovered: PhysicsElement | null = null;
    private closeTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly simulation: Destructor) {
        this.trigger = simulation.options.trigger;
        this.trigger.setAttribute("aria-pressed", "false");

        this.cursor = document.createElement("div");
        this.cursor.className = CLASS.cursor;
        this.cursor.setAttribute("aria-hidden", "true");
        this.sprite = document.createElement("div");
        this.sprite.className = CLASS.gun;
        this.cursor.append(this.sprite);
        document.body.append(this.cursor);

        this.listen();
    }

    get isEquipped(): boolean {
        return this.equipped;
    }

    private get sounds() {
        return this.simulation.sounds;
    }

    private listen(): void {
        // While equipped, links, context menus and native drags would get in
        // the way. Thrown elements are props, not controls, equipped or not:
        // stopping their events here keeps the page's own handlers off them.
        for (const type of ["click", "contextmenu", "dragstart"]) {
            document.addEventListener(
                type,
                (event) => {
                    const thrown = this.simulation.container.contains(
                        event.target as Node,
                    );
                    if (thrown) event.stopPropagation();
                    if (thrown || this.equipped) event.preventDefault();
                },
                { capture: true },
            );
        }

        document.addEventListener("mousedown", (event) =>
            this.onMouseDown(event),
        );
        document.addEventListener("mousemove", (event) =>
            this.onMouseMove(event),
        );
        document.addEventListener("mouseup", (event) => this.onMouseUp(event));

        this.trigger.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "mouse") this.sounds.play("weaponswitch");
        });
        this.trigger.addEventListener("click", (event) => this.press(event));
    }

    /**
     * Handles a press on the trigger: toggles the gun, or on touch screens
     * explains that it needs a mouse. Public so a consumer that creates the
     * simulation from a trigger click can forward that first click.
     */
    press(event: MouseEvent): void {
        // detail is 0 for keyboard activation, which has no position
        const keyboard = event.detail === 0;

        if (this.cannotAim(event, keyboard)) {
            this.trigger.dataset.hint =
                window.innerWidth <= NARROW_VIEWPORT ? "desktop" : "mouse";
            restartAnimation(this.trigger, "data-wiggle");
            this.sounds.play("dryfire");
            return;
        }

        if (!keyboard) this.moveTo(event.clientX, event.clientY);
        this.setEquipped(!this.equipped);
    }

    /** Whether the gun can't be aimed after this press: it needs a mouse. */
    private cannotAim(event: MouseEvent, keyboard: boolean): boolean {
        // No mouse on this device at all
        if (!matchMedia("(any-pointer: fine)").matches) return true;
        if (keyboard) return false;

        const { pointerType } = event as PointerEvent;
        return (
            pointerType === "touch" ||
            pointerType === "pen" ||
            // Touch emulation, and browsers whose click has no pointerType,
            // can pass a tap's click off as a mouse's. The touchstart before
            // it can't: a mouse never fires one.
            performance.now() - touchedAt < TOUCH_CLICK_WINDOW
        );
    }

    setEquipped(equipped: boolean): void {
        if (this.equipped === equipped) return;
        this.equipped = equipped;

        this.trigger.setAttribute("aria-pressed", String(equipped));
        document.documentElement.toggleAttribute(ROOT_ATTR.equipped, equipped);
        this.updateSprite();

        if (equipped) {
            delete this.trigger.dataset.hint;
            this.sounds.play("select");
        } else {
            this.setHovered(null);
            this.sounds.play("weaponswitch");
        }
    }

    private onMouseDown(event: MouseEvent): void {
        this.moveTo(event.clientX, event.clientY);
        // A press on the trigger unequips the gun instead of firing it
        if (!this.equipped || this.trigger.contains(event.target as Node)) {
            return;
        }

        if (this.hovered) {
            this.pickUp(this.hovered, event);
        } else {
            this.sounds.play("dryfire");
            restartAnimation(this.sprite, "data-recoil");
        }
    }

    private onMouseMove(event: MouseEvent): void {
        this.moveTo(event.clientX, event.clientY);
        if (this.equipped) {
            mouseHandlers(this.simulation.mouse).mousemove(event);
        }
    }

    private onMouseUp(event: MouseEvent): void {
        this.moveTo(event.clientX, event.clientY);
        this.drop(event);
    }

    private moveTo(x: number, y: number): void {
        this.cursor.style.translate = `${x}px ${y}px`;
        if (this.equipped) this.setHovered(this.held ?? this.findTarget(x, y));
    }

    /** The outermost grabbable element under the pointer. */
    private findTarget(x: number, y: number): PhysicsElement | null {
        let target: PhysicsElement | null = null;
        for (const element of document.elementsFromPoint(x, y)) {
            const candidate = this.simulation.getPhysicsElement(element);
            if (
                candidate?.isOverGrabRegion(x, y) &&
                (!target || candidate.element.contains(target.element))
            ) {
                target = candidate;
            }
        }
        return target;
    }

    private setHovered(hovered: PhysicsElement | null): void {
        const previous = this.hovered;
        if (hovered === previous) return;

        previous?.setHover(false);
        hovered?.setHover(true);
        this.hovered = hovered;
        this.updateSprite();

        if (!this.equipped) return;
        if (hovered && !previous) this.playOpen();
        else if (!hovered && previous) this.playClose();
    }

    private pickUp(target: PhysicsElement, event: MouseEvent): void {
        if (this.held) this.drop(event);
        this.simulation.extract(target);
        if (!target.body) return;

        this.held = target;
        this.updateSprite();
        this.sounds.play("pickup");
        this.sounds.play("holdloop");

        // Grab it on this press, without waiting for the next one
        mouseHandlers(this.simulation.mouse).mousedown(event);
        grab(this.simulation.mouseConstraint, [target.body]);
    }

    private drop(event: MouseEvent): void {
        mouseHandlers(this.simulation.mouse).mouseup(event);
        if (!this.held) return;

        this.held = null;
        this.updateSprite();
        this.sounds.stop("holdloop");
        this.sounds.play("drop");
        clearTimeout(this.closeTimeout);
        this.closeTimeout = undefined;
    }

    /** Opens the claws, unless they were about to close: then they stay open. */
    private playOpen(): void {
        if (this.closeTimeout === undefined) {
            this.sounds.play("open");
        } else {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
    }

    /** Debounced, so skimming across gaps between elements stays quiet. */
    private playClose(): void {
        clearTimeout(this.closeTimeout);
        this.closeTimeout = setTimeout(() => {
            this.sounds.play("close");
            this.closeTimeout = undefined;
        }, CLOSE_DEBOUNCE);
    }

    private updateSprite(): void {
        this.sprite.toggleAttribute("data-hover", this.hovered !== null);
        this.sprite.toggleAttribute("data-holding", this.held !== null);
    }
}
