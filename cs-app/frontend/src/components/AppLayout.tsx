import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import GlobalSearch from "./GlobalSearch";
import { ROLE_LABELS } from "../types";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "chart-bar" },
  { to: "/clientes", label: "Clientes", icon: "users" },
  { to: "/produtos", label: "Produtos", icon: "package" },
  { to: "/tarefas", label: "Tarefas", icon: "checklist" },
  { to: "/health-score", label: "Health Score", icon: "activity" },
  { to: "/riscos", label: "Riscos", icon: "alert-triangle" },
  { to: "/alertas", label: "Alertas", icon: "bell" },
  { to: "/relatorios", label: "Relatórios", icon: "file-text" },
  { to: "/expansao", label: "Expansão", icon: "trending-up" },
  { to: "/renovacao", label: "Renovação", icon: "refresh" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/usuarios", label: "Usuários", icon: "user-cog" },
  { to: "/auditoria", label: "Auditoria", icon: "history" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          background: "var(--surface-sidebar)",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: 18,
            color: "var(--text-inverse)",
            marginBottom: 24,
            padding: "0 6px",
          }}
        >
          3wings
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-inverse-muted)",
            padding: "0 6px",
            marginBottom: 6,
            letterSpacing: "0.04em",
          }}
        >
          CUSTOMER SUCCESS
        </div>

        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} to={item.to} label={item.label} />
        ))}

        {(user?.role === "administrador" || user?.role === "gestao" || user?.role === "gestor_cs") && (
          <>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-inverse-muted)",
                padding: "16px 6px 6px",
                letterSpacing: "0.04em",
              }}
            >
              ADMINISTRAÇÃO
            </div>
            {ADMIN_NAV_ITEMS.map((item) => (
              <SidebarLink key={item.to} to={item.to} label={item.label} />
            ))}
          </>
        )}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-inverse-muted)", padding: "0 6px" }}>
            {user?.name}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-inverse-muted)", padding: "0 6px", marginBottom: 8 }}>
            {user ? ROLE_LABELS[user.role] : ""}
          </div>
          <button
            onClick={logout}
            style={{
              width: "100%",
              background: "transparent",
              border: "0.5px solid #3a4553",
              color: "var(--text-inverse-muted)",
              borderRadius: "var(--radius-control)",
              padding: "8px 10px",
              fontSize: 13,
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "24px 28px", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <GlobalSearch />
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: isActive ? 500 : 400,
        textDecoration: "none",
        background: isActive ? "var(--color-blue)" : "transparent",
        color: isActive ? "var(--text-inverse)" : "var(--text-inverse-muted)",
      })}
    >
      {label}
    </NavLink>
  );
}
