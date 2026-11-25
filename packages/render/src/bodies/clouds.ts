import { Mesh, MeshStandardMaterial } from "three";
import { applyPatches, type Extra } from "./patches.ts";

/** The shell's size against the surface, enough to clear it without floating. */
const SHELL = 1.002;

/** A cloud shell on `sphere`, fixed to the surface, shown once `map` loads. */
export const cloudsExtra = (map: string, sphere: Mesh): Extra => {
    const material = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        transparent: true,
        depthWrite: false,
    });
    applyPatches(material, [
        {
            name: "cloud-dark",
            uniforms: {},
            declarations: "",
            // Ambient light made night-side clouds a grey veil over the city lights.
            code: `outgoingLight -= reflectedLight.indirectDiffuse;
            // Seen edge-on the shell stands clear of the surface, so it fades out at the limb.
            diffuseColor.a *= smoothstep(0.0, 0.3, dot(geometryNormal, geometryViewDir));`,
        },
    ]);
    const shell = new Mesh(sphere.geometry, material);
    shell.scale.setScalar(SHELL);
    shell.visible = false;
    sphere.add(shell);

    return {
        patches: [],
        load: (maps) =>
            maps.load(map, (texture) => {
                material.alphaMap = texture;
                material.needsUpdate = true;
                shell.visible = true;
            }),
        update: (_camera, geometry) => {
            shell.geometry = geometry;
        },
        dispose: () => {
            shell.removeFromParent();
            material.dispose();
        },
    };
};
