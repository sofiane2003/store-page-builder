/** A sentence for a failed server call. */
export function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.startsWith("[")) {
    try {
      const issues = JSON.parse(text) as { message?: string }[];
      if (issues[0]?.message) return issues[0].message;
    } catch {
      // Not a list of issues.
    }
  }
  return text || "That didn't work. Try again.";
}

/** A stored timestamp as a short date. */
export function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
