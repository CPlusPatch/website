/// <reference types="deno" />
import type { Vec3 } from "@cpluspatch/orbit";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertThrows,
} from "@std/assert";
import { Quaternion, Vector3 } from "three";
import { ease, focusTween } from "./framing.ts";
import {
    FOCUS_SECONDS,
    type Glide,
    type GlideNow,
    stepGlide,
    ZOOM_SNAP,
    ZOOM_TAU_SECONDS,
} from "./glide.ts";

const none: Glide<string> = {
    move: null,
    zoom: null,
    aim: null,
    look: null,
    up: null,
};

const now: GlideNow = {
    distance: 1000,
    direction: { x: 0, y: -1, z: 0 },
    look: { x: 0, y: 0, z: 0 },
    moveTo: null,
    behind: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 0, z: 1 },
    minDistance: 10,
    maxDistance: 100000,
    tanHalfFov: Math.tan(Math.PI / 8),
};

const assertVec = (actual: Vec3, expected: Vec3) => {
    assertAlmostEquals(actual.x, expected.x, 1e-9);
    assertAlmostEquals(actual.y, expected.y, 1e-9);
    assertAlmostEquals(actual.z, expected.z, 1e-9);
};

const move = (elapsed = 0) => ({
    from: { distance: 1000, position: { x: 0, y: 0, z: 0 } },
    target: "mars",
    distance: 200,
    elapsed,
});

const goal = { x: 5e9, y: 0, z: 0 };

Deno.test("a move ends at the focus time on the target pose and reports its target", () => {
    const step = stepGlide({ ...none, move: move() }, FOCUS_SECONDS, {
        ...now,
        moveTo: goal,
    });

    assertEquals(step.distance, 200);
    assertEquals(step.origin, goal);
    assertEquals(step.glide.move, null);
    assertEquals(step.ended?.target, "mars");
});

Deno.test("a move part way gives the focus tween pose and keeps running", () => {
    const m = move();
    const step = stepGlide({ ...none, move: m }, 0.1, { ...now, moveTo: goal });
    const pose = focusTween(
        m.from,
        { distance: 200, position: goal },
        0.1 / FOCUS_SECONDS,
        now.tanHalfFov,
    );

    assertEquals(step.distance, pose.distance);
    assertEquals(step.origin, pose.position);
    assertEquals(step.glide.move?.elapsed, 0.1);
    assertEquals(step.glide.move?.target, "mars");
    assertEquals(step.ended, null);
});

Deno.test("a move without a target position is an error", () => {
    assertThrows(() => stepGlide({ ...none, move: move() }, 0.1, now));
});

Deno.test("with no move the origin is left to the caller and the distance is kept", () => {
    const step = stepGlide(none, 0.1, now);

    assertEquals(step.origin, null);
    assertEquals(step.distance, 1000);
    assertEquals(step.direction, now.direction);
    assertEquals(step.look, now.look);
    assertEquals(step.up, now.up);
    assertEquals(step.ended, null);
});

Deno.test("a zoom isn't stepped while a move runs", () => {
    const step = stepGlide({ ...none, move: move(), zoom: { to: 50 } }, 0.1, {
        ...now,
        moveTo: goal,
    });

    assertEquals(step.glide.zoom, { to: 50 });
    assert(step.distance > 200);
});

Deno.test("a zoom closes part of its gap each step and then keeps running", () => {
    const step = stepGlide(
        { ...none, zoom: { to: 500 } },
        ZOOM_TAU_SECONDS,
        now,
    );

    assertAlmostEquals(step.distance, 1000 * 0.5 ** (1 - Math.exp(-1)), 1e-9);
    assertEquals(step.glide.zoom, { to: 500 });
});

Deno.test("a zoom is clamped again to limits that changed", () => {
    const step = stepGlide({ ...none, zoom: { to: 500 } }, 100, {
        ...now,
        minDistance: 800,
    });

    assertEquals(step.distance, 800);
    assertEquals(step.glide.zoom, null);
});

Deno.test("a zoom snaps to its end once within the snap ratio", () => {
    const close = 500 * (1 + ZOOM_SNAP / 2);
    const step = stepGlide({ ...none, zoom: { to: 500 } }, 0.1, {
        ...now,
        distance: close,
    });

    assertEquals(step.distance, 500);
    assertEquals(step.glide.zoom, null);
});

Deno.test("an aim swings toward behind by the eased share and ends at the full turn", () => {
    const aim = { from: { x: 0, y: -1, z: 0 }, elapsed: 0 };
    const half = stepGlide({ ...none, aim }, FOCUS_SECONDS / 2, now);
    const angle = (Math.PI / 2) * ease(0.5);

    assertVec(half.direction, {
        x: 0,
        y: -Math.cos(angle),
        z: Math.sin(angle),
    });
    assertEquals(half.glide.aim?.elapsed, FOCUS_SECONDS / 2);

    const done = stepGlide(half.glide, FOCUS_SECONDS / 2, now);

    assertVec(done.direction, now.behind);
    assertEquals(done.glide.aim, null);
});

Deno.test("a look lerps with the ease and ends at its goal", () => {
    const look = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: -2 },
        elapsed: 0,
    };
    const quarter = stepGlide({ ...none, look }, FOCUS_SECONDS / 4, now);

    assertVec(quarter.look, { x: 0, y: 0, z: -2 * ease(0.25) });
    assertEquals(quarter.glide.look?.elapsed, FOCUS_SECONDS / 4);

    const done = stepGlide(quarter.glide, FOCUS_SECONDS, now);

    assertEquals(done.look, look.to);
    assertEquals(done.glide.look, null);
});

Deno.test("with no up glide the up is its goal", () => {
    assertEquals(stepGlide(none, 0.1, now).up, now.up);
});

Deno.test("an up glide swings toward the goal and ends on it", () => {
    const up = { from: { x: 0, y: 1, z: 0 }, elapsed: 0 };
    const half = stepGlide({ ...none, up }, FOCUS_SECONDS / 2, now);
    const angle = (Math.PI / 2) * ease(0.5);

    assertVec(half.up, { x: 0, y: Math.cos(angle), z: Math.sin(angle) });
    assert(half.glide.up !== null);

    const done = stepGlide(half.glide, FOCUS_SECONDS, now);

    assertEquals(done.up, now.up);
    assertEquals(done.glide.up, null);
});

Deno.test("a swing to the opposite direction turns like three's setFromUnitVectors", () => {
    const from = new Vector3(0, 0, 1);
    const to = new Vector3(0, 0, -1);
    const turn = new Quaternion().setFromUnitVectors(from, to);
    const expected = from
        .clone()
        .applyQuaternion(new Quaternion().identity().slerp(turn, ease(0.5)));

    const step = stepGlide(
        { ...none, aim: { from: { x: 0, y: 0, z: 1 }, elapsed: 0 } },
        FOCUS_SECONDS / 2,
        { ...now, behind: { x: 0, y: 0, z: -1 } },
    );

    assertVec(step.direction, expected);
    assertAlmostEquals(
        Math.hypot(step.direction.x, step.direction.y, step.direction.z),
        1,
        1e-9,
    );
});

Deno.test("a step leaves its glide and vectors unchanged", () => {
    const glide: Glide<string> = {
        move: move(),
        zoom: { to: 500 },
        aim: { from: { x: 0, y: -1, z: 0 }, elapsed: 0 },
        look: {
            from: { x: 0, y: 0, z: 0 },
            to: { x: 0, y: 0, z: -1 },
            elapsed: 0,
        },
        up: { from: { x: 0, y: 1, z: 0 }, elapsed: 0 },
    };
    const input = { ...now, moveTo: { ...goal } };
    const glideCopy = structuredClone(glide);
    const nowCopy = structuredClone(input);

    const step = stepGlide(glide, 0.1, input);

    assertEquals(glide, glideCopy);
    assertEquals(input, nowCopy);
    assert(step.glide !== glide);
    assert(step.glide.move?.target === glide.move?.target);
});
