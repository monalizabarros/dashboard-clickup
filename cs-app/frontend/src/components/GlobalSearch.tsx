import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { SearchResultItem } from "../types";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<{ results: SearchResultItem[] }>(`/search?q=${encodeURIComponent(query)}`).then((data) => {
        setResults(data.results);
        setOpen(true);
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    if (item.client_id) navigate(`/clientes/${item.client_id}`);
    else if (item.type === "produto") navigate("/produtos");
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: 280 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Buscar clientes, tarefas, riscos..."
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: "var(--radius-control)",
          border: "0.5px solid var(--border-default)",
          fontSize: 13,
        }}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--surface-card)",
            border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-control)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 20,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => goTo(r)}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "0.5px solid var(--border-subtle)" }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{r.type}</div>
              <div style={{ fontSize: 13, color: "var(--color-graphite)" }}>{r.label}</div>
              {r.subtitle && <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{r.subtitle}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
