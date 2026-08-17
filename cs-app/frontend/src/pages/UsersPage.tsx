import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { ROLE_LABELS, type RoleName, type User } from "../types";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [RoleName, string][];

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api
      .get<User[]>("/users")
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar usuários."));
  }

  useEffect(load, []);

  async function toggleActive(user: User) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar usuário.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, color: "var(--color-graphite)" }}>Usuários</h1>
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
          {showForm ? "Cancelar" : "+ Novo usuário"}
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>{error}</div>}

      {showForm && (
        <NewUserForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div
        style={{
          background: "var(--surface-card)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
        }}
      >
        <div style={rowStyle("header")}>
          <div>NOME</div>
          <div>E-MAIL</div>
          <div>PERFIL</div>
          <div>STATUS</div>
          <div />
        </div>
        {users === null && <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Carregando...</div>}
        {users?.map((u) => (
          <div key={u.id} style={rowStyle("body")}>
            <div style={{ fontWeight: 500, color: "var(--color-graphite)" }}>{u.name}</div>
            <div style={{ color: "var(--text-secondary)" }}>{u.email}</div>
            <div style={{ color: "var(--text-secondary)" }}>{ROLE_LABELS[u.role]}</div>
            <div>
              <span
                style={{
                  background: u.is_active ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                  color: u.is_active ? "var(--color-success-text)" : "var(--color-danger-text)",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                {u.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => toggleActive(u)}
                style={{
                  background: "transparent",
                  border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-control)",
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                {u.is_active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function rowStyle(kind: "header" | "body"): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.4fr 1.6fr 1fr 0.8fr 0.8fr",
    alignItems: "center",
    padding: kind === "header" ? "10px 16px" : "11px 16px",
    fontSize: kind === "header" ? 11.5 : 13,
    color: kind === "header" ? "var(--text-muted)" : undefined,
    borderBottom: "0.5px solid var(--border-subtle)",
    letterSpacing: kind === "header" ? "0.03em" : undefined,
  };
}

function NewUserForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>("cs");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      onError("Preencha nome, e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/users", { name, email, role, password });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Erro ao criar usuário.");
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
        gridTemplateColumns: "1.2fr 1.4fr 1fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >
      <Field label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="E-mail">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldInput} />
      </Field>
      <Field label="Perfil">
        <select value={role} onChange={(e) => setRole(e.target.value as RoleName)} style={fieldInput}>
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Senha inicial">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldInput} />
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
