/**
 * Physics playground: pick up parts of the page with a gravity gun and
 * throw them around.
 * Adapted from https://www.half-life.com/en/halflife2/20th
 */

import Matter from "matter-js";
import {
    CLASS,
    DEFAULT_OPTIONS,
    type DestructorOptions,
    type ResolvedOptions,
    ROOT_ATTR,
} from "./config.ts";
import { getTextBounds, hasOwnText } from "./dom.ts";
import { PhysicsElement } from "./element.ts";
import { GravityGun } from "./gun.ts";
import { SoundEffects } from "./sfx.ts";

/** The size of the pieces `shatter()` breaks the page into, at most. */
const BRICK_SIZE = { width: 480, height: 240 };

// The ground is a slab this thick, so fast bodies can't tunnel through it
const GROUND_THICKNESS = 10_000;

export class Destructor {
    readonly options: ResolvedOptions;
    readonly sounds = new SoundEffects();
    readonly container: HTMLDivElement;
    readonly engine = Matter.Engine.create();
    /** Fed the page's mouse events; see mouseHandlers(). */
    readonly mouse: Matter.Mouse;
    readonly mouseConstraint: Matter.MouseConstraint;
    /** Null without a trigger to equip it with. */
    readonly gun: GravityGun | null;

    private readonly elements = new WeakMap<Element, PhysicsElement>();
    private readonly extracted = new Set<PhysicsElement>();
    private readonly ground: Matter.Body;
    /** Draws the bodies, in debug mode only. */
    private readonly renderer: Matter.Render | null = null;

    constructor(options: DestructorOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options };

        // Covers the viewport, so page and physics coordinates are the same
        this.container = document.createElement("div");
        this.container.className = CLASS.container;
        document.body.append(this.container);

        this.mouse = Matter.Mouse.create(this.container);
        this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
            mouse: this.mouse,
            constraint: {
                stiffness: 0.1,
                length: 0,
                render: { visible: true },
                // Let held bodies spin freely; missing from @types/matter-js
                ...{ angularStiffness: 0 },
            },
        });

        this.ground = Matter.Bodies.rectangle(0, 0, 100_000, GROUND_THICKNESS, {
            isStatic: true,
            render: { fillStyle: "orange", opacity: 0.5 },
        });
        const ceiling = Matter.Bodies.rectangle(0, -1500, 100_000, 1000, {
            isStatic: true,
        });
        Matter.Composite.add(this.engine.world, [
            this.mouseConstraint,
            this.ground,
            ceiling,
        ]);

        if (this.options.debug) {
            this.renderer = Matter.Render.create({
                element: this.container,
                engine: this.engine,
                options: { background: "transparent", wireframes: false },
            });
            this.renderer.canvas.className = CLASS.canvas;
            Matter.Render.run(this.renderer);
        }
        document.documentElement.toggleAttribute(
            ROOT_ATTR.debug,
            this.options.debug,
        );

        this.gun = this.options.trigger
            ? new GravityGun(this, this.options.trigger)
            : null;

        // Scrolling only moves the ground if it is a page element
        if (this.options.ground) {
            window.addEventListener("scroll", () => this.updateGround(), {
                passive: true,
            });
        }
        window.addEventListener("resize", () => this.resize());

        const runner = Matter.Runner.run(Matter.Runner.create(), this.engine);
        Matter.Events.on(runner, "afterTick", () => this.onTick());
        this.resize();
    }

    /**
     * Acts on a press of the trigger. Only needed for the press that created
     * the simulation, which happened before it was listening.
     */
    press(event: MouseEvent): void {
        this.gun?.press(event);
    }

    /**
     * Breaks everything in view above the ground out of the page at once, in pieces of at
     * most `BRICK_SIZE`, and flings each one a little. A piece is the
     * largest element that fits, or one too big that holds text of its own,
     * since that text can't fall without it.
     */
    shatter(): void {
        const { trigger, ground } = this.options;
        const width = window.innerWidth;
        // Pieces below the ground would start inside it and push the rest
        // through it
        const height = Math.min(
            window.innerHeight,
            ground?.getBoundingClientRect().top ?? Infinity,
        );
        const bricks: HTMLElement[] = [];

        const visit = (element: Element): void => {
            if (!(element instanceof HTMLElement)) return;

            // What holds the trigger or the ground can't go, but its other
            // children can
            const holds = (inner: Element | null): boolean =>
                Boolean(inner && inner !== element && element.contains(inner));
            if (holds(trigger) || holds(ground)) {
                for (const child of element.children) visit(child);
                return;
            }
            if (this.isExcluded(element)) return;

            const rect = element.getBoundingClientRect();
            const offscreen =
                rect.bottom <= 0 ||
                rect.right <= 0 ||
                rect.top >= height ||
                rect.left >= width;
            // No box (display: contents) doesn't mean no children to show
            const boxless = rect.width === 0 && rect.height === 0;
            if (offscreen && !boxless) return;

            const fits =
                rect.width <= BRICK_SIZE.width &&
                rect.height <= BRICK_SIZE.height;
            if (!boxless && (fits || hasOwnText(element))) {
                bricks.push(element);
                return;
            }
            for (const child of element.children) visit(child);
        };
        for (const child of document.body.children) visit(child);

        // Measured before any is moved, as moving one forces a layout
        for (const element of bricks) {
            const physicsElement =
                this.elements.get(element) ??
                this.track(element, this.isTextBounded(element));
            this.extract(physicsElement);
            const { body } = physicsElement;
            if (!body) continue;
            Matter.Body.setVelocity(body, {
                x: (Math.random() - 0.5) * 10,
                y: 0,
            });
            Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
        }
    }

    /**
     * The grabbable element for `element`, created the first time the gun
     * points at it. Undefined if it can't be picked up.
     */
    getPhysicsElement(element: Element): PhysicsElement | undefined {
        const known = this.elements.get(element);
        if (known) return known;

        const textBounded = this.isTextBounded(element);
        if (!this.isGrabbable(element, textBounded)) return undefined;

        return this.track(element, textBounded);
    }

    private isTextBounded(element: Element): boolean {
        return this.options.textBounded.some((s) => element.matches(s));
    }

    private track(element: HTMLElement, textBounded: boolean): PhysicsElement {
        const physicsElement = new PhysicsElement(element, textBounded);
        this.elements.set(element, physicsElement);
        return physicsElement;
    }

    /** Pulls an element out of the page and into the simulation. */
    extract(physicsElement: PhysicsElement): void {
        if (physicsElement.isExtracted) return;

        const body = physicsElement.extract(this.container, this.options.debug);
        Matter.Composite.add(this.engine.world, body);
        this.extracted.add(physicsElement);
        document.documentElement.setAttribute(ROOT_ATTR.active, "");
    }

    private isGrabbable(
        element: Element,
        textBounded: boolean,
    ): element is HTMLElement {
        const { options } = this;
        if (
            !(element instanceof HTMLElement) ||
            !options.draggable.some((s) => element.matches(s)) ||
            this.isExcluded(element)
        ) {
            return false;
        }

        // Measure what would become the body: the text, for text-bounded
        // elements, so a full-width heading can still be picked up
        const { width, height } =
            (textBounded && getTextBounds(element)) ||
            element.getBoundingClientRect();
        return (
            width <= options.maxSize.width && height <= options.maxSize.height
        );
    }

    /** Whether an element must stay where it is, whatever its size. */
    private isExcluded(element: HTMLElement): boolean {
        const { options } = this;
        return Boolean(
            options.neverDraggable.some((s) => element.matches(s)) ||
                // Clones left behind, and parts of things already thrown
                element.closest(`.${CLASS.placeholder}`) ||
                this.container.contains(element) ||
                // The gun's own controls, and what thrown things land on
                (options.trigger &&
                    (options.trigger.contains(element) ||
                        element.contains(options.trigger))) ||
                options.ground?.contains(element),
        );
    }

    private onTick(): void {
        for (const physicsElement of this.extracted) {
            if (physicsElement.body) this.wrap(physicsElement.body);
            physicsElement.updateTransform();
        }
    }

    /**
     * Bodies leaving one side of the viewport come back in at the other.
     * Fully inside it, so one that slid out slowly can't come to rest just
     * past the edge, out of sight.
     */
    private wrap(body: Matter.Body): void {
        const { min, max } = body.bounds;
        const width = window.innerWidth;
        if (min.x > width) {
            Matter.Body.translate(body, { x: -min.x, y: 0 });
        } else if (max.x < 0) {
            Matter.Body.translate(body, { x: width - max.x, y: 0 });
        }
    }

    private resize(): void {
        if (this.renderer) {
            const { innerWidth: width, innerHeight: height } = window;
            this.renderer.canvas.width = width;
            this.renderer.canvas.height = height;
            this.renderer.options.width = width;
            this.renderer.options.height = height;
        }
        this.updateGround();
    }

    /** Keeps the ground at the top of the ground element, or the viewport bottom. */
    private updateGround(): void {
        const top = Math.min(
            window.innerHeight,
            this.options.ground?.getBoundingClientRect().top ?? Infinity,
        );
        const y = top + GROUND_THICKNESS / 2;

        // Bodies live in viewport coordinates, so when the ground moves on
        // the page, carry them along with it
        const delta = y - this.ground.position.y;
        if (delta !== 0) {
            for (const physicsElement of this.extracted) {
                const { body } = physicsElement;
                if (!body) continue;
                Matter.Body.setPosition(
                    body,
                    Matter.Vector.create(
                        body.position.x,
                        body.position.y + delta,
                    ),
                );
                physicsElement.updateTransform(true);
            }
        }

        Matter.Body.setPosition(this.ground, Matter.Vector.create(0, y));
    }
}
