/**
 * Loads Plausible  The script itself already ignores localhost;
 * checking here as well keeps its request from being made.
 */
export function loadAnalytics(domain: string, src: string): void {
    const local =
        /^(localhost|127(\.\d+){0,2}\.\d+|\[::1?\])$/.test(location.hostname) ||
        location.protocol === "file:";
    if (local) return;

    const script = document.createElement("script");
    script.defer = true;
    script.src = src;
    script.dataset.domain = domain;
    document.head.append(script);
}
