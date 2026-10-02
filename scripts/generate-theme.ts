#!/usr/bin/env -S deno run --allow-read
/**
 * Palette generator for src/styles/theme.css.
 *
 *   deno run theme          print the token block + a contrast audit
 *   deno run theme:check    verify theme.css still matches this file (CI-safe)
 *
 * Why this exists
 * ---------------
 * The palette is not a set of hand-picked colours; it is a *ladder*. Every
 * role (primary, destructive, ...) sits at the same OKLCH lightness and
 * differs only in hue. That is what makes contrast a property of the system
 * rather than something to re-audit per colour, and it is what lets a single
 * --color-on-accent work as the foreground for every filled surface.
 *
 * Editing theme.css by hand breaks that guarantee silently. Change the CONFIG
 * below instead, re-run, and paste the output back.
 *
 * This script deliberately does not write theme.css itself: the file carries
 * explanatory comments that a generator would trample.
 */

// developer note: i didn't write this and have no fucking idea how it works,
// but it produces decent colours so i'm using it

// ---------------------------------------------------------------------------
// CONFIG -- this is the part you edit
// ---------------------------------------------------------------------------

/** Hue angles in OKLCH degrees. Inherited from the original hand-picked brand. */
const HUES = {
	primary: 3.8, // pink
	secondary: 303.7, // violet
	destructive: 27.3, // red
	warning: 91.9, // yellow
	success: 152, // green
} as const;

/**
 * Lightness per tier, per scheme.
 *
 *   role    text and fills -- must stay dark enough (light) / light enough
 *           (dark) to clear 4.5:1 against --color-bg.
 *   hover   the same tier, pushed one step further from the background.
 *   accent  decoration ONLY: borders, rules, the offset shadow. ~2:1, so it
 *           must never carry text or a meaning-bearing icon.
 *
 * Raising `role.light` or lowering `role.dark` is the single knob that trades
 * vividness for contrast. The audit at the bottom tells you when you went too
 * far.
 */
const TIERS = {
	role: { light: 0.45, dark: 0.78 },
	hover: { light: 0.37, dark: 0.86 },
	accent: { light: 0.72, dark: 0.7 },
} as const;

/**
 * Chroma policy. Taking the full in-gamut chroma makes hues that have lots of
 * headroom (violet) scream next to hues that have none (yellow at L=0.45), so
 * back off to a fraction of the maximum and cap the outliers. The result is a
 * palette that reads as one family.
 */
const CHROMA_RATIO = 0.9;
const CHROMA_CAP = 0.19;

/**
 * Neutrals are specified directly rather than derived -- they are tuned by eye
 * for the paper-ish light scheme and a flat dark scheme.
 *
 * Note the dark backgrounds are achromatic (C = 0). At low lightness even
 * C = 0.005 reads as a colour cast rather than as a warm/cool neutral. The
 * dark *text* tones keep the 155 hue on purpose: a slight tint there reads as
 * warmth, not as a cast.
 */
const NEUTRALS = {
	bg: { light: [0.9673, 0.0041, 157.2], dark: [0.1642, 0, 0] },
	"bg-alt": { light: [0.9362, 0.0058, 153.8], dark: [0.205, 0, 0] },
	surface: { light: [0.9893, 0.0025, 165.1], dark: [0.2297, 0, 0] },
	text: { light: [0.2056, 0.012, 156.0], dark: [0.8795, 0.0084, 157.1] },
	"text-muted": {
		light: [0.5061, 0.0116, 154.9],
		dark: [0.6449, 0.0128, 153.5],
	},
} as const;

/**
 * Borders are solved for a contrast ratio against --color-bg rather than for a
 * lightness, because the ratio is the thing that matters.
 *
 * 2.2 is deliberately under the 3:1 of WCAG 1.4.11: --color-border only ever
 * outlines surfaces already distinguished by their background. Anything where
 * the border itself carries the affordance (form controls) uses
 * --color-border-strong at 3.0.
 */
const BORDERS = {
	border: { ratio: 2.2, chroma: 0.0085, hue: 152 },
	"border-strong": { ratio: 3.0, chroma: 0.009, hue: 154 },
} as const;

type Scheme = "light" | "dark";
const SCHEMES: Scheme[] = ["light", "dark"];

// ---------------------------------------------------------------------------
// Colour maths -- OKLCH <-> sRGB, plus WCAG contrast
// ---------------------------------------------------------------------------

const OKLAB_TO_LMS = [
	[1, 0.3963377774, 0.2158037573],
	[1, -0.1055613458, -0.0638541728],
	[1, -0.0894841775, -1.291485548],
];
const LMS_TO_RGB = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
];

const mul = (m: number[][], v: number[]) =>
	m.map((row) => row.reduce((sum, c, i) => sum + c * v[i], 0));

/** Linear-light sRGB, which may be out of [0, 1] if the colour is out of gamut. */
function oklchToLinear(l: number, c: number, h: number): number[] {
	const rad = (h * Math.PI) / 180;
	const lms = mul(OKLAB_TO_LMS, [l, c * Math.cos(rad), c * Math.sin(rad)]);
	return mul(
		LMS_TO_RGB,
		lms.map((v) => v ** 3),
	);
}

const inGamut = (l: number, c: number, h: number) =>
	oklchToLinear(l, c, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** Largest chroma that still fits in sRGB at this lightness and hue. */
function maxChroma(l: number, h: number): number {
	let lo = 0;
	let hi = 0.5;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (inGamut(l, mid, h)) lo = mid;
		else hi = mid;
	}
	return lo;
}

const encode = (v: number) =>
	v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

function hex(l: number, c: number, h: number): string {
	return `#${oklchToLinear(l, c, h)
		.map((v) => Math.round(Math.min(1, Math.max(0, encode(v))) * 255))
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("")}`;
}

/** Relative luminance, straight from the WCAG 2.x definition. */
function luminance(hexColor: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const s = Number.parseInt(hexColor.slice(i, i + 2), 16) / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Bisect lightness until the colour hits a target contrast against `against`.
 * `darker` picks which side of the background to search.
 */
function solveLightness(
	target: number,
	against: string,
	chroma: number,
	hue: number,
	darker: boolean,
): string {
	// Lightness moves contrast monotonically once we know which side of the
	// background we are on, so a plain bisection is enough.
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (contrast(hex(mid, chroma, hue), against) > target) {
			if (darker) lo = mid;
			else hi = mid;
		} else {
			if (darker) hi = mid;
			else lo = mid;
		}
	}
	// Bisection converges on the continuous answer, but the output is
	// quantised to 8 bits per channel and can land a hundredth under target.
	// Step away from the background until the *rounded* colour clears it.
	let l = darker ? lo : hi;
	for (
		let i = 0;
		i < 16 && contrast(hex(l, chroma, hue), against) < target;
		i++
	) {
		l += darker ? -0.002 : 0.002;
	}
	return hex(l, chroma, hue);
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/** A role colour: fixed lightness for the tier, hue for the role, chroma per policy. */
function role(tier: keyof typeof TIERS, hue: number, scheme: Scheme): string {
	const l = TIERS[tier][scheme];
	return hex(l, Math.min(CHROMA_CAP, CHROMA_RATIO * maxChroma(l, hue)), hue);
}

const pair = (light: string, dark: string) => `light-dark(${light}, ${dark})`;
const bySchemes = (fn: (s: Scheme) => string) => pair(fn("light"), fn("dark"));

const tokens = new Map<string, string>();
const set = (name: string, value: string) => tokens.set(name, value);

for (const [name, spec] of Object.entries(NEUTRALS)) {
	set(
		`--color-${name}`,
		bySchemes((s) => hex(...(spec[s] as [number, number, number]))),
	);
}

// Backgrounds have to exist before borders can be solved against them.
const bgOf = (s: Scheme) =>
	hex(...(NEUTRALS.bg[s] as [number, number, number]));
for (const [name, spec] of Object.entries(BORDERS)) {
	set(
		`--color-${name}`,
		bySchemes((s) =>
			solveLightness(
				spec.ratio,
				bgOf(s),
				spec.chroma,
				spec.hue,
				s === "light",
			),
		),
	);
}

set("--color-grid", pair("rgb(0 0 0 / 0.04)", "rgb(255 255 255 / 0.03)"));

for (const [name, hue] of Object.entries(HUES)) {
	set(
		`--color-${name}`,
		bySchemes((s) => role("role", hue, s)),
	);
	set(
		`--color-${name}-hover`,
		bySchemes((s) => role("hover", hue, s)),
	);
}

// One foreground for every filled surface -- valid precisely because the role
// tier shares a lightness. If you break that invariant, this breaks too.
set("--color-on-accent", pair(bgOf("light"), bgOf("dark")));

for (const [name, hue] of Object.entries(HUES)) {
	set(
		`--color-${name}-accent`,
		bySchemes((s) => role("accent", hue, s)),
	);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const THEME = new URL("../src/styles/theme.css", import.meta.url);

function audit(): string[] {
	const lines: string[] = [];
	const resolve = (name: string, s: Scheme) => {
		const v = tokens.get(name) as string;
		const m = v.match(/light-dark\((.+), (.+)\)/);
		if (!m) throw new Error(`${name} is not a light-dark() pair`);
		return s === "light" ? m[1] : m[2];
	};
	for (const s of SCHEMES) {
		const bg = resolve("--color-bg", s);
		const on = resolve("--color-on-accent", s);
		const row = (label: string, ratio: number, min: number) =>
			`  ${ratio >= min ? "ok " : "FAIL"} ${label.padEnd(22)}${ratio.toFixed(2)} (min ${min})`;
		lines.push(`[${s}]`);
		lines.push(
			row("text / bg", contrast(resolve("--color-text", s), bg), 4.5),
		);
		lines.push(
			row(
				"text-muted / bg",
				contrast(resolve("--color-text-muted", s), bg),
				4.5,
			),
		);
		lines.push(
			row("border / bg", contrast(resolve("--color-border", s), bg), 2.2),
		);
		lines.push(
			row(
				"border-strong / bg",
				contrast(resolve("--color-border-strong", s), bg),
				3,
			),
		);
		for (const name of Object.keys(HUES)) {
			const c = resolve(`--color-${name}`, s);
			// Each role must work as text on the page AND as a fill under
			// --color-on-accent, so take the worse of the two.
			const worst = Math.min(contrast(c, bg), contrast(c, on));
			lines.push(row(`${name} (text & fill)`, worst, 4.5));
		}
	}
	return lines;
}

const block = [...tokens].map(([k, v]) => `\t${k}: ${v};`).join("\n");

if (Deno.args.includes("--check")) {
	const css = await Deno.readTextFile(THEME);
	const drift = [...tokens].filter(([name, value]) => {
		const m = css.match(new RegExp(`^\\s*${name}:\\s*(.+);`, "m"));
		return !m || m[1].trim() !== value;
	});
	if (drift.length > 0) {
		console.error(
			"theme.css has drifted from scripts/generate-theme.ts:\n",
		);
		for (const [name, value] of drift)
			console.error(`  ${name}\n    expected ${value}`);
		console.error("\nRe-run `deno run theme` and paste the block back in.");
		Deno.exit(1);
	}
	console.log(`✓ theme.css matches the generator (${tokens.size} tokens).`);
} else {
	console.log(block);
	console.log(`\n/* Contrast audit\n${audit().join("\n")}\n*/`);
}
