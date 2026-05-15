const SENSITIVE_KEY_PATTERN = /(password|secret|token|key|authorization|cookie|credential|stripe|email|phone)/i;

export function securityLog(event: string, metadata: Record<string, unknown> = {}) {
  console.warn(`[security] ${event}`, redact(metadata));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redact(entry)
    ])
  );
}
