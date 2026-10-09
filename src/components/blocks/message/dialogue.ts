/** What the other side says, and the reader's ways to answer. */
export interface DialogueNode {
    /** One or more messages, sent one after another. */
    messages: string[];
    /** The reader's replies. With none, the conversation ends here. */
    options?: DialogueOption[];
}

export interface DialogueOption {
    /** Shown on the option's button. */
    label: string;
    /** What the reader sends, when it says more than the label. */
    reply?: string;
    /** The other side's answer. Without one, the conversation ends on the reply. */
    next?: DialogueNode;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** A beat before the other side starts typing. */
const PAUSE = 400;

/** How long a message takes to "type": longer for longer ones, within reason. */
const typingTime = (text: string) => Math.min(1800, 500 + text.length * 20);

/**
 * Plays an <InteractiveMessage>'s dialogue tree. The markup comes from the
 * component's templates, which are real Messages and Buttons rendered on the
 * server, so the script only clones them and fills in text.
 */
export const bindDialogue = (root: HTMLElement) => {
    const part = (name: string) =>
        root.querySelector<HTMLElement>(`[data-dialogue-${name}]`);
    const log = part("log");
    const options = part("options");
    const restart = part("restart");
    const data = part("tree");
    if (!log || !options || !restart || !data?.textContent) return;

    const tree: DialogueNode = JSON.parse(data.textContent);
    const clone = (name: string) => {
        const template = root.querySelector<HTMLTemplateElement>(
            `template[data-dialogue-template="${name}"]`,
        );
        return template?.content.firstElementChild?.cloneNode(
            true,
        ) as HTMLElement;
    };
    /** A template with its text filled in. Text only, never markup. */
    const say = (name: string, text: string) => {
        const element = clone(name);
        const slot = element.querySelector("[data-dialogue-text]");
        if (slot) slot.textContent = text;
        return element;
    };
    // Keeps the latest message in view. A no-op unless something caps the
    // log's height; smooth, unless motion is reduced, by its CSS.
    const follow = () => {
        log.scrollTop = log.scrollHeight;
    };
    const add = (parent: HTMLElement, child: HTMLElement) => {
        child.dataset.new = "";
        parent.append(child);
        follow();
    };

    // The server rendered the opening; a restart rewinds to it. Restarting
    // is only offered once a branch has ended, so never mid-reply.
    const opening = log.childElementCount;

    const pick = async (option: DialogueOption) => {
        // Keep focus in the component while the options are away. They
        // stay in place, hidden, so the row holds its height (see the CSS).
        const focused = root.contains(document.activeElement);
        options.dataset.waiting = "";
        if (focused) options.focus();

        const mine = clone("group");
        add(log, mine);
        add(mine, say("reply", option.reply ?? option.label));

        const next = option.next;
        if (next) {
            await sleep(PAUSE);
            const theirs = clone("group");
            add(log, theirs);
            for (const text of next.messages) {
                const typing = clone("typing");
                add(theirs, typing);
                await sleep(typingTime(text));
                const message = say("message", text);
                message.dataset.new = "";
                typing.replaceWith(message);
                follow();
            }
        }
        offer(next?.options ?? [], focused);
    };

    restart.addEventListener("click", () => {
        while (log.childElementCount > opening) log.lastElementChild?.remove();
        offer(tree.options ?? [], true);
    });

    /** Fills in the reader's options; their buttons animate in by CSS. */
    const render = (choices: DialogueOption[]) => {
        const buttons = choices.map((option) => {
            const button = say("option", option.label);
            button.addEventListener("click", () => pick(option));
            return button;
        });
        options.replaceChildren(...buttons);
        delete options.dataset.waiting;
        return buttons;
    };

    /** After a turn: the next options, or a way to start over once there are none. */
    const offer = (choices: DialogueOption[], focus: boolean) => {
        const buttons = render(choices);
        restart.hidden = buttons.length > 0;
        if (focus) (buttons[0] ?? restart).focus({ preventScroll: true });
        // A new row of options can change the log's height.
        follow();
        options.scrollIntoView({ block: "nearest" });
    };

    // A capped log will scroll, so its scrollbar's room is kept from the
    // start, rather than squeezing the conversation when it first appears.
    // (A set height reads back in pixels whether capped or not, so only the
    // documented max-block-size counts.)
    root.toggleAttribute(
        "data-capped",
        getComputedStyle(root).maxBlockSize !== "none",
    );

    options.hidden = false;
    render(tree.options ?? []);
};
