/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { Clock } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import {
    encodeScenario,
    HASH_PREFIX,
    readSaved,
    type SavedStorage,
    STORAGE_KEY,
} from "./persistence.ts";
import { createSession } from "./session.ts";
import { Scene } from "./state/scene.ts";
import type { Notices } from "./ui/notices.ts";

const memory = (): SavedStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
    };
};

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const earthOnly = {
    ...solarSystem,
    bodies: solarSystem.bodies.filter(
        (body) => body.id === "sun" || body.id === "earth",
    ),
};

const setup = (
    hash = "",
    rebuildFn: () => void = () => {},
    updateFn: (change: {
        added: string[];
        removed: string[];
    }) => void = () => {},
) => {
    const scene = new Scene(solarSystem, new Clock(0, 1, false));
    const storage = memory();
    const shown: string[] = [];
    const notices: Pick<Notices, "show"> = {
        show: (_variant, content) => {
            shown.push(String(content));
        },
    };
    const page = {
        hash: () => state.hash,
        stripHash: () => {
            state.hash = "";
            state.stripped++;
        },
        hidden: () => state.hidden,
        window: new EventTarget(),
        document: new EventTarget(),
    };
    const state = {
        hash,
        hidden: false,
        stripped: 0,
        rebuilt: 0,
        updated: [] as { added: string[]; removed: string[] }[],
    };
    const session = createSession({
        scene,
        storage,
        notices,
        page,
        rebuild: () => {
            state.rebuilt++;
            rebuildFn();
        },
        update: (change) => {
            state.updated.push(change);
            updateFn(change);
        },
    });

    return { scene, storage, shown, page, state, session };
};

const saved = (storage: SavedStorage) => {
    const result = readSaved(storage);

    return result?.ok ? result.scenario : null;
};

Deno.test("a change is saved after the delay, not at once", async () => {
    const { scene, storage, session } = setup();

    scene.setClock({ t: 42 });
    assertEquals(storage.getItem(STORAGE_KEY), null);

    await wait(600);

    assertEquals(saved(storage)?.time, 42);

    session.destroy();
});

Deno.test("a focus or a selection is not saved", () => {
    const { scene, storage, session } = setup();

    scene.focus("earth");
    scene.select("earth");
    session.destroy();

    assertEquals(storage.getItem(STORAGE_KEY), null);
});

Deno.test("a change that is still pending is saved when the session is destroyed", () => {
    const { scene, storage, session } = setup();

    scene.setClock({ t: 7 });
    session.destroy();

    assertEquals(saved(storage)?.time, 7);
});

Deno.test("pagehide saves at once with the clock time", () => {
    const { scene, storage, page, session } = setup();

    scene.clock.set(99);
    page.window.dispatchEvent(new Event("pagehide"));

    assertEquals(saved(storage)?.time, 99);

    session.destroy();
});

Deno.test("visibilitychange saves at once only when the page is hidden", () => {
    const { scene, storage, page, state, session } = setup();

    scene.clock.set(5);
    page.document.dispatchEvent(new Event("visibilitychange"));
    assertEquals(storage.getItem(STORAGE_KEY), null);

    state.hidden = true;
    page.document.dispatchEvent(new Event("visibilitychange"));
    assertEquals(saved(storage)?.time, 5);

    session.destroy();
});

Deno.test("a scenario event calls rebuild, and other events don't", () => {
    const { scene, state, session } = setup();

    scene.focus("earth");
    scene.setClock({ t: 1 });
    assertEquals(state.rebuilt, 0);

    scene.load(earthOnly, 0);
    assertEquals(state.rebuilt, 1);

    session.destroy();
});

Deno.test("loading a valid link loads it, strips the hash and saves", async () => {
    const hash =
        HASH_PREFIX + (await encodeScenario({ ...earthOnly, time: 321 }));
    const { scene, storage, state, session } = setup(hash);

    await session.loadHash();

    assertEquals(scene.scenario.bodies.length, earthOnly.bodies.length);
    assertEquals(scene.clock.t, 321);
    assertEquals(state.stripped, 1);
    assertEquals(state.hash, "");
    assertEquals(saved(storage)?.bodies.length, earthOnly.bodies.length);

    session.destroy();
});

Deno.test("loading a bad link shows a notice and leaves the scene alone", async () => {
    const { scene, storage, shown, state, session } = setup(
        `${HASH_PREFIX}garbage`,
    );

    await session.loadHash();

    assertEquals(scene.scenario, solarSystem);
    assertEquals(shown, [
        "The shared link isn't a valid scenario, so nothing changed.",
    ]);
    assertEquals(state.stripped, 1);
    assertEquals(storage.getItem(STORAGE_KEY), null);

    session.destroy();
});

Deno.test("loading with no link does nothing", async () => {
    const { scene, storage, shown, state, session } = setup("#other");

    await session.loadHash();

    assertEquals(scene.scenario, solarSystem);
    assertEquals(shown, []);
    assertEquals(state.stripped, 0);
    assertEquals(storage.getItem(STORAGE_KEY), null);

    session.destroy();
});

Deno.test("a hashchange loads the link", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { scene, page, session } = setup(hash);

    const loaded = new Promise<void>((resolve) => {
        scene.on((event) => {
            if (event.type === "scenario") resolve();
        });
    });
    page.window.dispatchEvent(new Event("hashchange"));
    await loaded;

    assertEquals(scene.scenario.bodies.length, earthOnly.bodies.length);

    session.destroy();
});

Deno.test("a load that a newer scenario overtakes is dropped", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { scene, shown, session } = setup(hash);
    const newer = { ...earthOnly, name: "newer" };

    const loading = session.loadHash();
    scene.load(newer, 0);
    await loading;

    assertEquals(scene.scenario, newer);
    assertEquals(shown, []);

    session.destroy();
});

Deno.test("after destroy the listeners are gone and a pending load is dropped", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { scene, storage, page, state, session } = setup(hash);

    const loading = session.loadHash();
    session.destroy();
    await loading;

    assert(scene.scenario.bodies.length > earthOnly.bodies.length);

    scene.clock.set(8);
    page.window.dispatchEvent(new Event("pagehide"));
    state.hidden = true;
    page.document.dispatchEvent(new Event("visibilitychange"));
    state.hash = hash;
    page.window.dispatchEvent(new Event("hashchange"));
    await wait(50);
    scene.setClock({ t: 9 });
    await wait(600);

    assertEquals(storage.getItem(STORAGE_KEY), null);
    assertEquals(state.rebuilt, 0);
    assert(scene.scenario.bodies.length > earthOnly.bodies.length);
});

const rock = (id: string): Body => {
    const body = solarSystem.bodies.find(
        (candidate) => candidate.id === "moon",
    );
    if (!body?.elements) throw new Error("The scenario has no Moon.");

    return { ...body, id, name: id, parent: "earth" };
};

Deno.test("a rebuild that throws reloads the last scenario, keeps the focus and isn't saved", async () => {
    const { scene, storage, shown, session } = setup(
        "",
        () => {
            if (scene.scenario.bodies.some((body) => body.id === "rock")) {
                throw new Error("no view");
            }
        },
        () => {
            throw new Error("no patch");
        },
    );
    const written: string[] = [];
    storage.setItem = (_key, value) => {
        written.push(value);
    };
    scene.focus("earth");

    scene.addBody(rock("rock"));
    await wait(600);

    assertEquals(scene.scenario, solarSystem);
    assertEquals(scene.focused, "earth");
    assertEquals(shown, ["The model can't be drawn."]);
    assertEquals(written.length, 1);
    assertEquals(
        written.some((value) => value.includes('"rock"')),
        false,
    );

    session.destroy();
});

Deno.test("a failed rebuild keeps an orbit edited before it", () => {
    const { scene, session } = setup(
        "",
        () => {
            if (scene.scenario.bodies.some((body) => body.id === "rock")) {
                throw new Error("no view");
            }
        },
        () => {
            throw new Error("no patch");
        },
    );
    const moon = scene.scenario.bodies.find((body) => body.id === "moon");
    if (!moon?.elements) throw new Error("The scenario has no Moon.");

    scene.setElements("moon", { ...moon.elements, e: 0.2 });
    scene.addBody(rock("rock"));

    const after = scene.scenario.bodies.find((body) => body.id === "moon");
    assertEquals(after?.elements?.e, 0.2);

    session.destroy();
});

Deno.test("a bodies event calls update and not rebuild", () => {
    const { scene, state, session } = setup();

    scene.addBody(rock("rock"));
    scene.removeBody("rock");

    assertEquals(state.updated, [
        { added: ["rock"], removed: [] },
        { added: [], removed: ["rock"] },
    ]);
    assertEquals(state.rebuilt, 0);

    session.destroy();
});

Deno.test("an update that throws falls back to a rebuild", () => {
    const { scene, state, shown, session } = setup(
        "",
        () => {},
        () => {
            throw new Error("no patch");
        },
    );

    scene.addBody(rock("rock"));

    assertEquals(state.rebuilt, 1);
    assertEquals(shown, []);
    assert(scene.scenario.bodies.some((body) => body.id === "rock"));

    session.destroy();
});

Deno.test("an update and a rebuild that both throw show the notice and restore the last scenario", () => {
    const { scene, state, shown, session } = setup(
        "",
        () => {
            if (scene.scenario.bodies.some((body) => body.id === "rock")) {
                throw new Error("no view");
            }
        },
        () => {
            throw new Error("no patch");
        },
    );

    scene.addBody(rock("rock"));

    assertEquals(scene.scenario, solarSystem);
    assertEquals(shown, ["The model can't be drawn."]);
    // The failed rebuild, then the restore's.
    assertEquals(state.rebuilt, 2);

    session.destroy();
});

Deno.test("a failure after an update restores the scenario with its change", () => {
    const has = (id: string) =>
        scene.scenario.bodies.some((body) => body.id === id);
    const { scene, shown, session } = setup(
        "",
        () => {
            if (has("rock2")) throw new Error("no view");
        },
        (change) => {
            if (change.added.includes("rock2")) throw new Error("no patch");
        },
    );

    scene.addBody(rock("rock"));
    scene.addBody(rock("rock2"));

    assertEquals(shown, ["The model can't be drawn."]);
    assert(has("rock"));
    assert(!has("rock2"));

    session.destroy();
});

Deno.test("a rebuild that always throws shows the notice and doesn't loop", () => {
    const { scene, state, shown, session } = setup("", () => {
        throw new Error("no view");
    });

    scene.load(earthOnly, 0);

    assertEquals(state.rebuilt, 2);
    assertEquals(shown, ["The model can't be drawn."]);

    session.destroy();
});

Deno.test("a hashchange whose load rejects shows the invalid notice", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { scene, page, shown, session } = setup(hash);
    scene.on((event) => {
        if (event.type === "scenario") throw new Error("listener");
    });
    let unhandled = false;
    const onUnhandled = (event: PromiseRejectionEvent) => {
        event.preventDefault();
        unhandled = true;
    };
    globalThis.addEventListener("unhandledrejection", onUnhandled);

    page.window.dispatchEvent(new Event("hashchange"));
    await wait(100);
    globalThis.removeEventListener("unhandledrejection", onUnhandled);

    assertEquals(shown, ["The shared link couldn't be opened."]);
    assertEquals(unhandled, false);

    session.destroy();
});
