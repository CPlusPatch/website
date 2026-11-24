import {
    AdditiveBlending,
    CanvasTexture,
    type Color,
    Sprite,
    SpriteMaterial,
    SRGBColorSpace,
} from "three";

const TEXTURE_PX = 128;
const STOPS = 16;
// The disc fills a third of the sprite, and this leaves 0.44 of the glow at its limb.
const FALLOFF = 2;
const OPACITY = 0.3;

/** A white glow that is brightest at the centre and fades to nothing at the edge. */
export const coronaTexture = (): CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to draw coronas.");

    const mid = TEXTURE_PX / 2;
    const glow = context.createRadialGradient(mid, mid, 0, mid, mid, mid);
    for (let i = 0; i <= STOPS; i++) {
        const s = i / STOPS;
        glow.addColorStop(s, `rgba(255, 255, 255, ${(1 - s) ** FALLOFF})`);
    }
    context.fillStyle = glow;
    context.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
};

/** A star's glow. Its scale is set each frame, and the star's disc hides the part behind it. */
export const createCorona = (texture: CanvasTexture, color: Color): Sprite => {
    const material = new SpriteMaterial({
        map: texture,
        color,
        opacity: OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
    // At a w of ~1e11 km, SwiftShader interpolates the UVs wrong and the glow draws as an
    // hourglass. The sprite always faces the camera, so dividing by w here loses nothing.
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            "#include <logdepthbuf_vertex>",
            "#include <logdepthbuf_vertex>\n\tgl_Position /= gl_Position.w;",
        );
    };
    material.customProgramCacheKey = () => "corona";

    return new Sprite(material);
};
