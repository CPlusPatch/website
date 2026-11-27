<script lang="ts">
import type { SVGAttributes } from "svelte/elements";
import { type IconName, iconSvg, isIconName } from "../icons.ts";

/**
 * A built-in icon by name, such as `lucide:x`. Unlike the Astro icon, this
 * one has no astro-icon fallback: only the icons in icons.ts are drawn.
 * It forwards only `class` and `aria-hidden`.
 */
interface Props extends Omit<SVGAttributes<SVGSVGElement>, "name"> {
    name: `lucide:${IconName}`;
}

const { name, class: className, ...rest }: Props = $props();

const builtIn = $derived.by(() => {
    const icon = name.startsWith("lucide:") ? name.slice("lucide:".length) : "";

    // Fail loudly: a missing icon would otherwise render an empty <svg>.
    if (!isIconName(icon)) {
        throw new Error(
            `Unknown icon "${name}": the Svelte icon only draws the built-in icons (see icons.ts).`,
        );
    }

    return icon;
});
</script>

{@html iconSvg(builtIn, {
    class: typeof className === "string" ? className : undefined,
    ariaHidden: rest["aria-hidden"] != null,
})}
