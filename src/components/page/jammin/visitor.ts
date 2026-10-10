/**
 * What the /jammin page knows about whoever opens it: what any server they
 * connect to sees (their IP and what it says about them), and what their
 * browser tells every page it loads.
 */

/** A labelled line, like "City: Paris". */
export interface Line {
    label: string;
    value: string;
}

/** Where an IP lookup service says the visitor is, and through whom. */
interface Network {
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    isp?: string;
    org?: string;
    asn?: string;
}

/** Gives up on a lookup service after this long, and tries the next. */
const LOOKUP_TIMEOUT = 5000;

/**
 * The lookup services, tried in order until one answers. Each turns its own
 * answer into a Network, or throws if it says the lookup failed.
 */
// biome-ignore lint/suspicious/noExplicitAny: each service's own JSON, read field by field
type Answer = Record<string, any>;

const LOOKUPS: [string, (data: Answer) => Network][] = [
    [
        "https://ipwho.is/",
        (data) => {
            if (data.success === false) throw new Error(data.message);
            return {
                ip: data.ip,
                country: data.country,
                region: data.region,
                city: data.city,
                zip: data.postal,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone?.id,
                isp: data.connection?.isp,
                org: data.connection?.org,
                asn: data.connection?.asn && `AS${data.connection.asn}`,
            };
        },
    ],
    [
        "https://ipapi.co/json/",
        (data) => {
            if (data.error) throw new Error(data.reason);
            return {
                ip: data.ip,
                country: data.country_name,
                region: data.region,
                city: data.city,
                zip: data.postal,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone,
                org: data.org,
                asn: data.asn,
            };
        },
    ],
    // The address alone, if nothing else answers
    ["https://api.ipify.org/?format=json", (data) => ({ ip: data.ip })],
];

/** The first lookup service to answer, or nothing if none do. */
const lookUp = async (signal: AbortSignal): Promise<Network> => {
    for (const [url, parse] of LOOKUPS) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.any([
                    signal,
                    AbortSignal.timeout(LOOKUP_TIMEOUT),
                ]),
            });
            if (!response.ok) throw new Error(`${response.status}`);
            return parse(await response.json());
        } catch {
            if (signal.aborted) break;
        }
    }
    return {};
};

/** The browser's name and version, from its user agent string. */
const browserOf = (ua: string) => {
    // Most specific first: Edge and Opera also say Chrome, Chrome says Safari
    const known: [string, RegExp][] = [
        ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
        ["Opera", /(?:OPR|Opera)\/([\d.]+)/],
        ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
        ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
        ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
        ["Safari", /Version\/([\d.]+).*Safari/],
    ];
    for (const [name, pattern] of known) {
        const match = ua.match(pattern);
        if (match) return { name, version: match[1] };
    }
    return {};
};

/** Whether this is a phone or tablet. iPads say they're Macs, but have touch. */
const isMobile = (ua: string) =>
    (navigator as { userAgentData?: { mobile: boolean } }).userAgentData
        ?.mobile ||
    /Mobi|Android|iPhone|iPad|iPod|Tablet/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

/** The GPU, unmasked, if the browser lets WebGL say. */
const gpuOf = (): { vendor?: string; renderer?: string } => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    if (!gl || !info) return {};
    const gpu = {
        vendor: gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return gpu;
};

/** The current time where the visitor is. */
const timeIn = (timezone?: string) => {
    try {
        return new Intl.DateTimeFormat(undefined, {
            timeStyle: "medium",
            timeZone: timezone,
        }).format();
    } catch {
        // An unknown time zone
        return undefined;
    }
};

/**
 * Everything known about the visitor, one labelled line each, leaving out
 * whatever couldn't be found.
 */
export const gatherLines = async (signal: AbortSignal): Promise<Line[]> => {
    const net = await lookUp(signal);
    const ua = navigator.userAgent;
    const browser = browserOf(ua);
    const platform =
        (navigator as { userAgentData?: { platform: string } }).userAgentData
            ?.platform || navigator.platform;
    const { width, height, pixelDepth, orientation } = screen;
    const { innerWidth, innerHeight } = window;
    const gpu = gpuOf();

    const lines: [string, unknown][] = [
        ["IP Address", net.ip],
        ["Country", net.country],
        ["Region", net.region],
        ["City", net.city],
        ["ZIP Code", net.zip],
        [
            "Full Location",
            [net.city, net.region, net.country].filter(Boolean).join(", "),
        ],
        ["Latitude", net.latitude],
        ["Longitude", net.longitude],
        ["Timezone", net.timezone],
        ["Current Time", net.timezone && timeIn(net.timezone)],
        ["ISP", net.isp],
        ["Organization", net.org],
        ["Autonomous System", net.asn],
        ["Browser Name", browser.name],
        ["Platform", platform],
        ["Browser Version", browser.version],
        ["Mobile/Tablet", isMobile(ua) ? "Yes" : "No"],
        ["Referrer", document.referrer || "None"],
        ["System Languages", navigator.languages?.join(", ")],
        ["Screen Width", `${width}px`],
        ["Screen Height", `${height}px`],
        ["Window Width", innerWidth !== width && `${innerWidth}px`],
        ["Window Height", innerHeight !== height && `${innerHeight}px`],
        ["Pixel Depth", pixelDepth && `${pixelDepth}-bit`],
        [
            "Screen Orientation",
            orientation?.type &&
                (orientation.type.startsWith("portrait")
                    ? "Portrait"
                    : "Landscape"),
        ],
        ["Screen Rotation", orientation && `${orientation.angle}°`],
        ["CPU Threads", navigator.hardwareConcurrency],
        ["GPU Vendor", gpu.vendor],
        ["GPU Renderer", gpu.renderer],
    ];

    return lines
        .filter(
            ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== "" &&
                value !== false,
        )
        .map(([label, value]) => ({ label, value: String(value) }));
};
