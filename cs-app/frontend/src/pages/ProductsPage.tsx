import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { Product } from "../types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [moduleFormFor, setModuleFormFor] = useState<string | null>(null);

  function load() {
    api
      .get<Product[]>("/products")
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar produtos."));
  }

  useEffect(load, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Catálogo de produtos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: "var(--color-blue)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-control)",
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {showForm ? "Cancelar" : "+ Novo produto"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewProductForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {products === null && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {products?.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum produto cadastrado ainda.</div>
        )}
        {products?.map((p) => (
          <div
            key={p.id}
            style={{
              background: "var(--surface-card)",
              border: "0.5px solid var(--border-default)",
              borderRadius: "var(--radius-card)",
              padding: "14px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-graphite)" }}>{p.name}</div>
                {p.description && (
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{p.description}</div>
                )}
              </div>
              <button
                onClick={() => setModuleFormFor(moduleFormFor === p.id ? null : p.id)}
                style={{
                  background: "transparent",
                  border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-control)",
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                {moduleFormFor === p.id ? "Cancelar" : "+ Módulo"}
              </button>
            </div>

            {p.modules.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.modules.map((m) => (
                  <span
                    key={m.id}
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      background: "var(--surface-page)",
                      padding: "3px 10px",
                      borderRadius: "var(--radius-pill)",
                    }}
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            )}

            {moduleFormFor === p.id && (
              <div style={{ marginTop: 10 }}>
                <NewModuleForm
                  productId={p.id}
                  onCreated={() => {
                    setModuleFormFor(null);
                    load();
                  }}
                  onError={setError}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProductForm({ onCreated, onError }: { onCreated: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      onError("Informe o nome do produto.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/products", { name, description: description || null });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar produto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--surface-card)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-card)",
        padding: "16px 18px",
        display: "grid",
        gridTemplateColumns: "1fr 2fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >
      <Field label="Nome do produto">
        <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Descrição">
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={fieldInput} />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        style={{
          background: "var(--color-blue)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-control)",
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 500,
          height: 36,
        }}
      >
        Criar
      </button>
    </form>
  );
}

function NewModuleForm({
  productId,
  onCreated,
  onError,
}: {
  productId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      onError("Informe o nome do módulo.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/modules`, { name, description: description || null });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar módulo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do módulo" style={fieldInput} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        style={fieldInput}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{
          background: "var(--color-blue)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-control)",
          padding: "7px 12px",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        Adicionar
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      {label}
      {children}
    </label>
  );
}

const fieldInput: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "7px 9px",
  borderRadius: "var(--radius-control)",
  border: "0.5px solid var(--border-default)",
  fontSize: 13,
};
