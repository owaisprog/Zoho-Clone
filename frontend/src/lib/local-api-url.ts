// The early-stage demo must never fetch a remote production/customer API.
export function safeLocalApiBase(raw: string | undefined): URL | null {
  try {
    const url = new URL(raw ?? "http://127.0.0.1:4000");
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) ||
        Boolean(url.username || url.password || url.search || url.hash) ||
        (url.pathname !== "/" && url.pathname !== "") ||
        (url.port && !/^\d{1,5}$/.test(url.port))) return null;
    return url;
  } catch {
    return null;
  }
}
