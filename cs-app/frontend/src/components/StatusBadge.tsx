import type { ClientStatusTone } from "../types";

const TONE_STYLES: Record<ClientStatusTone, { bg: string; text: string }> = {
  success: { bg: "var(--color-success-bg)", text: "var(--color-success-text)" },
  warning: { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" },
  danger: { bg: "var(--color-danger-bg)", text: "var(--color-danger-text)" },
  neutral: { bg: "var(--surface-page)", text: "var(--text-secondary)" },
};

export default function StatusBadge({ label, tone }: { label: string; tone: ClientStatusTone }) {
  const { bg, text } = TONE_STYLES[tone];
  return (
    <span
      style={{
        background: bg,
        color: text,
        fontSize: 12,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
