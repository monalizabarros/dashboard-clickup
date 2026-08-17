import { useState } from "react";
import { downloadFile, ApiError } from "../api/client";

const REPORTS = [
  { key: "carteira", label: "Carteira de clientes" },
  { key: "health-score", label: "Health Score" },
  { key: "satisfacao", label: "Satisfação (NPS/CSAT)" },
  { key: "onboarding", label: "Onboarding e adoção" },
  { key: "utilizacao", label: "Utilização de módulos" },
];

export default function ReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(key: string) {
    setDownloading(key);
    setError(null);
    try {
      await downloadFile(`/reports/${key}.csv`, `${key}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao exportar relatório.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Relatórios</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Exportação em CSV, compatível com Excel.</div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REPORTS.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-card)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "14px 18px" }}>
            <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>{r.label}</div>
            <button
              onClick={() => handleDownload(r.key)}
              disabled={downloading === r.key}
              style={{ background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-control)", padding: "7px 14px", fontSize: 13, fontWeight: 500 }}
            >
              {downloading === r.key ? "Baixando..." : "Baixar CSV"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
