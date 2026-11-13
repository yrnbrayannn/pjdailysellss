import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useApp } from "./lib/useApp";
import Audit from "./pages/Audit";
import Butchery from "./pages/Butchery";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import More from "./pages/More";
import Orders from "./pages/Orders";
import Stock from "./pages/Stock";
import Suppliers from "./pages/Suppliers";

/** Admin lands on the dashboard, staff on the order form. */
function Home() {
  const { role } = useApp();
  return <Navigate to={role === "admin" ? "/dashboard" : "/orders"} replace />;
}

/** Staff can only see the entry forms; admin-only pages bounce them back. */
function AdminOnly({ children }: { children: ReactNode }) {
  const { role } = useApp();
  return role === "admin" ? <>{children}</> : <Navigate to="/orders" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="butchery" element={<Butchery />} />
          <Route path="stock" element={<Stock />} />
          <Route path="more" element={<More />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="dashboard" element={<AdminOnly><Dashboard /></AdminOnly>} />
          <Route path="menu" element={<AdminOnly><Menu /></AdminOnly>} />
          <Route path="suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />
          <Route path="audit" element={<AdminOnly><Audit /></AdminOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
