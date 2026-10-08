import Matter from "matter-js";
import { CLASS } from "./config.ts";
import {
    bakeComputedStyles,
    clonePlaceholder,
    forceSize,
    getCumulativeRotation,
    getTextBounds,
} from "./dom.ts";
import { hasMoved } from "./matter.ts";
import {
    bodyTransform,
    decompose,
    type Position,
    type Size,
} from "./transform.ts";

/** How far a hovered element lifts, in px. */
const HOVER_LIFT = 4;

/** What an element needs, once thrown, to follow its body. */
interface Extraction {
    body: Matter.Body;
    /** Border box, unscaled. */
    size: Size;
    scale: number;
    /** Body centre relative to the element's, for text-bounded bodies. */
    offset: Position;
}

const centerOf = (rect: DOMRect): Position => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
});

/** A page element the gravity gun can pull out and throw around. */
export class PhysicsElement {
    private extraction: Extraction | null = null;
    /** Inline transform from before the hover lift; null while not lifted. */
    private preHoverTransform: string | null = null;

    constructor(
        readonly element: HTMLElement,
        /** Whether its hit box and body are its text, not its whole box. */
        private readonly textBounded: boolean,
    ) {
        element.classList.add(CLASS.element);
    }

    get body(): Matter.Body | null {
        return this.extraction?.body ?? null;
    }

    get isExtracted(): boolean {
        return this.extraction !== null;
    }

    /** Lifts the element while the gun points at it. */
    setHover(hovered: boolean): void {
        if (this.isExtracted || hovered === (this.preHoverTransform !== null)) {
            return;
        }

        this.element.classList.toggle(CLASS.hover, hovered);
        const { style } = this.element;

        if (hovered) {
            this.preHoverTransform = style.transform;
            // Lift it in screen space, on top of whatever transform it has
            const current = getComputedStyle(this.element).transform;
            style.transform = `translate(0, -${HOVER_LIFT}px) ${current === "none" ? "" : current}`;
        } else {
            style.transform = this.preHoverTransform ?? "";
            this.preHoverTransform = null;
        }
    }

    /**
     * Whether a point already known to be over the element is over the part
     * that can be grabbed: its text, for text-bounded elements.
     */
    isOverGrabRegion(clientX: number, clientY: number): boolean {
        if (!this.textBounded) return true;

        const bounds = this.getTextBounds();
        return (
            clientX >= bounds.left &&
            clientX <= bounds.right &&
            clientY >= bounds.top &&
            clientY <= bounds.bottom
        );
    }

    /**
     * Swaps the element for a placeholder, moves it into `container` and
     * returns the body it should follow from now on.
     */
    extract(container: HTMLElement, showPlaceholder: boolean): Matter.Body {
        if (this.extraction) return this.extraction.body;
        const { element } = this;

        // Measure it as it sits on the page, not lifted by the hover style
        this.setHover(false);

        const rect = element.getBoundingClientRect();
        const { rotate, scale } = decompose(
            new DOMMatrixReadOnly(getComputedStyle(element).transform),
        );
        // Inline boxes have no offset size of their own
        const inline = getComputedStyle(element).display === "inline";
        const size = inline
            ? { width: rect.width, height: rect.height }
            : { width: element.offsetWidth, height: element.offsetHeight };

        let center = centerOf(rect);
        let bodySize = {
            width: size.width * scale,
            height: size.height * scale,
        };
        let offset = { x: 0, y: 0 };
        if (this.textBounded) {
            const text = this.getTextBounds();
            const textCenter = centerOf(text);
            offset = {
                x: (textCenter.x - center.x) / scale,
                y: (textCenter.y - center.y) / scale,
            };
            center = textCenter;
            bodySize = { width: text.width, height: text.height };
        }

        const body = Matter.Bodies.rectangle(
            center.x,
            center.y,
            bodySize.width,
            bodySize.height,
            { render: { fillStyle: "aqua", opacity: 0.5 } },
        );
        Matter.Body.setAngle(
            body,
            rotate + (getCumulativeRotation(element) * Math.PI) / 180,
        );

        this.swapForPlaceholder(size, inline, showPlaceholder);
        container.append(element);
        this.extraction = { body, size, scale, offset };
        this.updateTransform(true);
        return body;
    }

    /** Leaves a placeholder holding its spot in the page layout. */
    private swapForPlaceholder(
        size: Size,
        inline: boolean,
        showPlaceholder: boolean,
    ): void {
        const { element } = this;
        bakeComputedStyles(element);
        // The body's position and angle already include these. Inline, so no
        // page rule that still matches after the move can apply them again.
        element.style.translate = "none";
        element.style.rotate = "none";

        const placeholder = clonePlaceholder(element);
        placeholder.classList.remove(CLASS.element, CLASS.hover);
        placeholder.classList.add(CLASS.placeholder);
        placeholder.inert = true;
        placeholder.setAttribute("aria-hidden", "true");
        // Inline, to beat the opacity baked into the clone
        placeholder.style.opacity = showPlaceholder ? "0.3" : "0";
        element.replaceWith(placeholder);

        // Baking pinned the width and height, except of inline boxes
        if (inline) forceSize(element, size.width, size.height);

        Object.assign(element.style, {
            position: "absolute",
            top: "0px",
            left: "0px",
            bottom: "initial",
            right: "initial",
            margin: "initial",
            transformOrigin: "initial",
            transition: "none",
        });
        if (element.style.display === "list-item") {
            element.style.display = "block";
        }
        element.classList.add(CLASS.extracted);
    }

    /** Moves the element to where its body is. */
    updateTransform(force = false): void {
        if (!this.extraction) return;
        const { body, size, scale, offset } = this.extraction;

        if (!force && !hasMoved(body)) return;

        this.element.style.transform = bodyTransform(
            body.position,
            body.angle,
            size,
            scale,
            offset,
        );
    }

    private getTextBounds(): DOMRect {
        // No text to measure, e.g. a paragraph that only holds an image
        return (
            getTextBounds(this.element) ?? this.element.getBoundingClientRect()
        );
    }
}
