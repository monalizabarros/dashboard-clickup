export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>{title}</h1>
      <div
        style={{
          background: "var(--surface-card)",
          border: "0.5px dashed var(--border-default)",
          borderRadius: "var(--radius-card)",
          padding: "40px 24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Este módulo ainda será construído nos próximos blocos.
      </div>
    </div>
  );
}
