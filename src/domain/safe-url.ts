export function isSafeSourceUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return raw.length <= 2048 && url.protocol === "https:" && !url.username && !url.password && !url.port
      && !host.includes(":") && !host.startsWith("[") && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)
      && ![".localhost", ".local", ".internal", ".test", ".example", ".invalid", ".onion"].some((suffix) => host.endsWith(suffix))
      && host.length <= 253 && host.split(".").length > 1
      && host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      && /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(host.split(".").at(-1) ?? "");
  } catch { return false; }
}
