import type { Elements } from "@cpluspatch/orbit";
import type { AUnit } from "@cpluspatch/render";
import { isOrbiting, type Readouts, readouts, statesAt } from "@cpluspatch/sim";
import type { DocumentStore } from "../../state/document.svelte.ts";
import { draftPlate, livePlate, type PlateData } from "./plate.ts";

/** What the headline and the plate show, as of the last refresh. */
export type Live = {
    current: Readouts | null;
    unit: AUnit | null;
    plate: PlateData | null;
    /** The clock in seconds since J2000. */
    t: number;
};

/** An open form that draws its draft in the plate. */
export type DraftForm = { elements(): Elements | null; mu: number };

/** What the card shows of body `id` at time `t`. */
export const liveAt = (
    documents: Pick<DocumentStore, "doc" | "system" | "colorOf">,
    id: string,
    t: number,
    unit: AUnit | null,
    form: DraftForm | undefined,
): Live => {
    const scenario = documents.doc.scenario;
    const current = readouts(
        documents.system,
        id,
        statesAt(documents.system, t),
        t,
    );
    const selected = scenario.bodies.find((b) => b.id === id);
    const around = scenario.bodies.find(
        (b) => b.id === selected?.orbit?.parent,
    );
    let plate: PlateData | null = null;

    if (selected && isOrbiting(selected) && around) {
        const grandparent = scenario.bodies.find(
            (b) => b.id === around.orbit?.parent,
        );
        const drawn = {
            parentRadius: around.mass.radius,
            bodyColor: documents.colorOf(selected, around),
            parentColor: documents.colorOf(around, grandparent),
            unit,
        };

        // A form draws its draft, without the times, as they'd be of the saved orbit.
        const draft = form?.elements();
        if (form && draft) {
            plate = draftPlate(draft, form.mu, t, drawn);
        } else if (current) {
            // Precession turns the node and the periapsis.
            const now = documents.system.elementsAt(selected.id, t);
            plate = livePlate(now, current, drawn);
        }
    }

    return { current, unit, plate, t };
};
