import type { Body } from "@cpluspatch/orbit";
import {
    BufferAttribute,
    DoubleSide,
    type Group,
    Mesh,
    MeshStandardMaterial,
    RingGeometry,
    type Texture,
    Vector2,
    Vector3,
} from "three";
import { ringSpan, ringUvs } from "../geometry/rings.ts";
import { applyPatches, type Extra } from "./patches.ts";

/** How dark a fully opaque part of the rings makes Saturn's direct light. */
const SHADOW = 0.8;

/** How bright the face of the rings away from the sun is, against the face towards it. */
const BACKLIT = 0.4;

/**
 * Sunlight the rings get at any sun angle. Each ring particle is lit like a small moon, so the
 * rings don't go dark when the sun lies in their plane, as a flat sheet would.
 */
const FILL = 0.12;

/** How much of the sky shows through the rings where Saturn's shadow falls on them. */
const SHADOW_SEE_THROUGH = 0.6;

/** Saturn's rings, lit on both faces, with their shadow on Saturn and Saturn's on them. */
export const ringsExtra = (body: Body, group: Group, sphere: Mesh): Extra => {
    const { inner, outer } = ringSpan(body.radius);
    // Uniforms shared by both materials, in view space and with the sphere's own units.
    const shared = {
        saturnCenter: { value: new Vector3() },
        saturnPole: { value: new Vector3() },
        saturnRadius: { value: body.radius / 1000 },
        ringSpan: { value: new Vector2(inner, outer) },
    };
    const ringShadowMap: { value: Texture | null } = { value: null };
    const ringOn = { value: 0 };

    const geometry = new RingGeometry(inner, outer, 256, 1);
    geometry.setAttribute(
        "uv",
        new BufferAttribute(
            ringUvs(geometry.getAttribute("position").array, inner, outer),
            2,
        ),
    );
    // The ring is built in XY, and the sphere's equator is its XZ.
    geometry.rotateX(-Math.PI / 2);

    const material = new MeshStandardMaterial({
        roughness: 1,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    });
    applyPatches(material, [
        {
            name: "ring-light",
            uniforms: shared,
            declarations:
                "uniform vec3 saturnCenter;\nuniform float saturnRadius;",
            // A ray from the fragment to the sun is shadowed if it passes through Saturn's disc.
            code: `vec3 toSun = normalize(pointLights[0].position - geometryPosition);
            vec3 rel = (geometryPosition - saturnCenter) / saturnRadius;
            float along = dot(rel, toSun);
            float miss = length(rel - toSun * along);
            float shadow = along < 0.0 ? 1.0 - smoothstep(0.88, 1.0, miss) : 0.0;
            // Unlit ring dust covers the stars less, so the shadow doesn't read as a solid slab.
            diffuseColor.a *= 1.0 - ${SHADOW_SEE_THROUGH.toFixed(2)} * shadow;
            // The rings are translucent, so the face away from the sun keeps some light.
            vec3 back = diffuseColor.rgb * RECIPROCAL_PI * pointLights[0].color
                * saturate(-dot(geometryNormal, toSun)) * ${BACKLIT.toFixed(2)};
            vec3 fill = diffuseColor.rgb * RECIPROCAL_PI * pointLights[0].color * ${FILL.toFixed(2)};
            vec3 direct = reflectedLight.directDiffuse + reflectedLight.directSpecular + back + fill;
            outgoingLight += back + fill - direct * shadow;`,
        },
    ]);
    const mesh = new Mesh(geometry, material);
    // After the orbit lines, so the near arc covers Saturn's own orbit line.
    mesh.renderOrder = 1;
    mesh.visible = false;
    sphere.add(mesh);

    const pole = new Vector3();

    return {
        patches: [
            {
                name: "ring-shadow",
                uniforms: { ...shared, ringShadowMap, ringOn },
                declarations: `uniform vec3 saturnCenter;
                uniform vec3 saturnPole;
                uniform float saturnRadius;
                uniform vec2 ringSpan;
                uniform sampler2D ringShadowMap;
                uniform float ringOn;`,
                // The sun ray from the surface crosses the ring plane at a radius that sets u.
                code: `if (ringOn > 0.5) {
                vec3 toSun = normalize(pointLights[0].position - geometryPosition);
                vec3 rel = (geometryPosition - saturnCenter) / saturnRadius;
                float rise = dot(toSun, saturnPole);
                float height = dot(rel, saturnPole);
                if (abs(rise) > 1e-4 && height * rise < 0.0) {
                    vec3 hit = rel - toSun * (height / rise);
                    float u = (length(hit) - ringSpan.x) / (ringSpan.y - ringSpan.x);
                    if (u > 0.0 && u < 1.0) {
                        // Level 0, because a branch has no derivatives to pick a level.
                        float alpha = textureLod(ringShadowMap, vec2(u, 0.5), 0.0).a;
                        vec3 direct = reflectedLight.directDiffuse + reflectedLight.directSpecular;
                        outgoingLight -= direct * ${SHADOW.toFixed(2)} * alpha;
                    }
                }
            }`,
            },
        ],
        load: (maps) =>
            maps.load("saturn-ring", (texture) => {
                // Anisotropic filtering beaded the fine radial detail of the B ring.
                texture.anisotropy = 1;
                material.map = texture;
                material.needsUpdate = true;
                ringShadowMap.value = texture;
                ringOn.value = 1;
                mesh.visible = true;
            }),
        update: (camera) => {
            const view = camera.matrixWorldInverse;
            shared.saturnCenter.value.copy(group.position).applyMatrix4(view);
            pole.set(0, 1, 0).applyQuaternion(sphere.quaternion);
            shared.saturnPole.value.copy(pole).transformDirection(view);
        },
        dispose: () => {
            mesh.removeFromParent();
            geometry.dispose();
            material.dispose();
        },
    };
};
