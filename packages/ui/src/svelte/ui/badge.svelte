<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
    type BadgeSize,
    type BadgeVariant,
    badgeClasses,
} from "../../components/badge.ts";
import type { Tone } from "../../lib/tone.ts";

interface Props extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    tone?: Tone;
    size?: BadgeSize;
    children?: Snippet;
}

const {
    variant = "solid",
    tone = "primary",
    size = "default",
    class: className,
    children,
    ...rest
}: Props = $props();
</script>

<span
    class={badgeClasses({ variant, tone, size, class: className as string })}
    data-snap=""
    {...rest}
>
    {@render children?.()}
</span>
