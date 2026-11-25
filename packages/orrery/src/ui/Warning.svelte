<script lang="ts">
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";

type Props = {
    text: string;
    hidden: boolean;
};

const { text, hidden }: Props = $props();
</script>

<div
    class="{alertClasses({ variant: "warning", icon: true }).join(
        " ",
    )} orrery__warning"
    role="status"
    {hidden}
>
    <!-- Lucide's triangle-alert (ISC); @cpluspatch/ui only ships the icons its components draw. -->
    <svg
        class="icon"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
    >
        <path
            d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"
        />
    </svg>
    <div class="content">
        <p>
            <span class="visually-hidden">{alertPrefix("warning") ?? ""}</span>
            <span>{text}</span>
        </p>
    </div>
</div>
