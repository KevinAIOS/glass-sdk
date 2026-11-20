/** Excluded product/telemetry services, including every upstream hostname found in the pinned source. */
export const BLOCKED_SERVICE_DOMAINS = [
  "mentra.gl", "mentra.com", "mentra.glass", "mentraglass.com", "mentraglass.cn",
  "mentraos.com", "mentra.cn", "augmentos.org", "augmentos.com",
  "posthog.com", "sentry.io", "authing.cn", "authing.com",
] as const

export function isBlockedServiceHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.+$/, "")
  return BLOCKED_SERVICE_DOMAINS.some(domain => normalized === domain || normalized.endsWith("." + domain))
}
