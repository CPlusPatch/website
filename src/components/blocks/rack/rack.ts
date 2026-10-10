import type { Tone } from "../../../lib/tone.ts";
import { playWhileVisible } from "../../ui/pause-button.ts";

/** A unit in a <Rack>. */
export interface RackUnit {
    name: string;
    /** What it runs, on its label under its name. */
    about?: string;
    /**
     * Its front: drives and a grille, a wall of drives, a switch's ports, or
     * a vented blank. Units under the first switch are cabled to it.
     */
    kind?: "server" | "storage" | "switch" | "blank";
    /** In rack units. */
    height?: number;
}

/** A kind of request, and the units it visits in turn, by name. */
export interface RackFlow {
    name: string;
    path: string[];
    tone?: Tone;
}

/** Pixels a packet travels in a millisecond. */
const SPEED = 0.5;
/** Milliseconds between requests. */
const INTERVAL = 200;

/*
 * A cable's way, around the edges of its own box: out of the switch along
 * its top, down its side, and into the unit along its bottom. Its borders
 * are 2px, outside the box, so their middles are 1px out.
 */
const WAY = [
    { left: "0", top: "-1px" },
    { left: "calc(100% + 1px)", top: "-1px" },
    { left: "calc(100% + 1px)", top: "calc(100% + 1px)" },
    { left: "0", top: "calc(100% + 1px)" },
];

/**
 * Plays traffic on a <Rack>: the switch sends each request down the cable of
 * each unit on its path in turn and back, lighting the units' activity
 * lights. Plays while in view and not paused.
 */
export const bindRack = (root: HTMLElement) => {
    const flows: RackFlow[] = JSON.parse(root.dataset.flows ?? "[]");
    const hub = root.querySelector(".unit--switch");
    if (!hub || !flows.length) return;

    const flash = (unit: Element) =>
        unit
            .querySelector(".unit__light--activity")
            ?.animate(
                [{ opacity: 1, boxShadow: "0 0 0.5rem currentColor" }, {}],
                { duration: 400, easing: "ease-out" },
            );

    const send = async ({ path, tone = "primary" }: RackFlow) => {
        for (const name of path) {
            const unit = root.querySelector(`[data-unit="${name}"]`);
            const cable = root.querySelector<HTMLElement>(
                `[data-cable="${name}"]`,
            );
            if (!unit || !cable) continue;

            const packet = document.createElement("span");
            packet.className = `rack__packet tone-${tone}`;
            cable.append(packet);

            // At an even speed: the offsets follow each stretch's length
            const across = cable.offsetWidth;
            const length = 2 * across + cable.offsetHeight;
            const frames = WAY.map((point, i) => ({
                ...point,
                offset: [0, across, length - across, length][i] / length,
            }));
            const timing = {
                duration: length / SPEED,
                fill: "forwards",
            } as const;

            flash(hub);
            await packet.animate(frames, timing).finished;
            flash(unit);
            await packet.animate(frames, { ...timing, direction: "reverse" })
                .finished;
            packet.remove();
        }
        flash(hub);
    };

    playWhileVisible(
        root,
        root.querySelector("[data-rack-live]"),
        INTERVAL,
        () => send(flows[Math.floor(Math.random() * flows.length)]),
    );
};
