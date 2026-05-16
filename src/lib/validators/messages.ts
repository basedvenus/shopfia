export type ValidationIssueLike = {
  code?: string;
  maximum?: number | bigint;
  minimum?: number | bigint;
  message: string;
  path: Array<string | number>;
};

export function friendlyValidationMessage(
  issues: ValidationIssueLike[],
  labels: Record<string, string>,
  fallback = "Check the highlighted fields and try again."
) {
  const issue = issues[0];
  if (!issue) return fallback;

  const field = String(issue.path[0] ?? "");
  const label = labels[field];
  const message = issue.message;

  if (issue.code === "too_big" && typeof issue.maximum !== "undefined") {
    const maximum = String(issue.maximum);
    return label
      ? `${label} is a little too long. Keep it under ${maximum} characters.`
      : `Keep it under ${maximum} characters.`;
  }

  if (issue.code === "too_small") {
    return label ? `${label} is required.` : "A required field is missing.";
  }

  if (/string must contain at most/i.test(message)) {
    const limit = message.match(/\d+/)?.[0];
    return label && limit
      ? `${label} is a little too long. Keep it under ${limit} characters.`
      : limit
      ? `Keep it under ${limit} characters.`
      : fallback;
  }

  if (/invalid input|required|expected|received/i.test(message)) {
    return label ? `${label} is required.` : fallback;
  }

  return label ? message.replace(/^String/i, label) : message;
}
