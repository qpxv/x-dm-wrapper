export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) {
    return "now";
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
