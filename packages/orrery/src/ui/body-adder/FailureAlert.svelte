<script lang="ts">
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";

type Props = {
    text: string;
    hidden: boolean;
};

const { text, hidden }: Props = $props();
</script>

<div
    class="{alertClasses({ variant: "destructive" }).join(" ")} orrery__warning"
    role="alert"
    {hidden}
>
    <div class="content">
        <p>
            <span class="visually-hidden"
                >{alertPrefix("destructive") ?? ""}</span
            >
            <span>{text}</span>
        </p>
    </div>
</div>
