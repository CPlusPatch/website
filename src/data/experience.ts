export const languages: {
    name: string;
    logo: string;
}[] = [
    {
        name: "TypeScript",
        logo: "logos:typescript-icon",
    },
    // Hidden until the `logos` icon set has a correct NixOS logo.
    /* {
        name: "NixOS",
        logo: "logos:nixos",
    }, */
    {
        name: "Vue",
        logo: "logos:vue",
    },
    {
        name: "JavaScript",
        logo: "logos:javascript",
    },
    {
        name: "React",
        logo: "logos:react",
    },
    {
        name: "Next.js",
        logo: "logos:nextjs-icon",
    },
    {
        name: "CSS",
        logo: "logos:css",
    },
    {
        name: "HTML",
        logo: "logos:html-5",
    },
    {
        name: "Firebase",
        logo: "logos:firebase-icon",
    },
    {
        name: "Supabase",
        logo: "logos:supabase-icon",
    },
    {
        name: "Node.js",
        logo: "logos:nodejs-icon",
    },
    {
        name: "Bun",
        logo: "logos:bun",
    },
    {
        name: "NPM",
        logo: "logos:npm-icon",
    },
    {
        name: "PNPM",
        logo: "logos:pnpm",
    },
    {
        name: "Yarn",
        logo: "logos:yarn",
    },
    {
        name: "TailwindCSS",
        logo: "logos:tailwindcss-icon",
    },
    {
        name: "Unreal Engine",
        logo: "logos:unrealengine-icon",
    },
    {
        name: "Github",
        logo: "logos:github-icon",
    },
    {
        name: "Discord.js",
        logo: "logos:discord-icon",
    },
    {
        name: "Python",
        logo: "logos:python",
    },
    {
        name: "PHP",
        logo: "logos:php",
    },
    {
        name: "Laravel",
        logo: "logos:laravel",
    },
    {
        name: "Vite",
        logo: "logos:vite-icon",
    },
    {
        name: "Git",
        logo: "logos:git-icon",
    },
    {
        name: "Docker",
        logo: "logos:docker-icon",
    },
    {
        name: "Arduino",
        logo: "logos:arduino",
    },
    {
        name: "Raspberry Pi",
        logo: "logos:raspberry-pi",
    },
    // Hidden until the `logos` icon set has a correct jQuery logo.
    /* {
        name: "JQuery",
        logo: "logos:jquery",
    }, */
    {
        name: "Rust",
        logo: "logos:rust",
    },
    {
        name: "Ubuntu",
        logo: "logos:ubuntu",
    },
    {
        name: "Arch Linux",
        logo: "logos:archlinux",
    },
    {
        name: "Nuxt 3",
        logo: "logos:nuxt-icon",
    },
    {
        name: "Godot",
        logo: "logos:godot-icon",
    },
].toSorted((a, b) => a.name.localeCompare(b.name));
