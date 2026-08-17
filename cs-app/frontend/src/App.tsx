import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import AuditPage from "./pages/AuditPage";
import ClientsPage from "./pages/ClientsPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import ProductsPage from "./pages/ProductsPage";
import HealthScoreConfigPage from "./pages/HealthScoreConfigPage";
import RisksOverviewPage from "./pages/RisksOverviewPage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import ReportsPage from "./pages/ReportsPage";
import TasksPage from "./pages/TasksPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:id" element={<CustomerDetailPage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/tarefas" element={<TasksPage />} />
          <Route path="/health-score" element={<HealthScoreConfigPage />} />
          <Route path="/riscos" element={<RisksOverviewPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/expansao" element={<PlaceholderPage title="Expansão" />} />
          <Route path="/renovacao" element={<PlaceholderPage title="Renovação" />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/auditoria" element={<AuditPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
