import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useApp } from "./lib/useApp";
import type { Role } from "./lib/types";
import Audit from "./pages/Audit";
import Butchery from "./pages/Butchery";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import More from "./pages/More";
import Orders from "./pages/Orders";
import RawItems from "./pages/RawItems";
import Stock from "./pages/Stock";
import Suppliers from "./pages/Suppliers";
import Team from "./pages/Team";

const HOME: Record<Role, string> = {
  admin: "/dashboard",
  cashier: "/dashboard",
  butcher: "/butchery",
  staff: "/orders",
};

/** Everyone lands on the screen that matters most for their job. */
function Home() {
  const { role } = useApp();
  return <Navigate to={HOME[role]} replace />;
}

/** Only the listed roles may open the page; everyone else is sent to their own home screen. */
function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useApp();
  return roles.includes(role) ? <>{children}</> : <Navigate to={HOME[role]} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="orders" element={<Only roles={["admin", "cashier", "staff"]}><Orders /></Only>} />
          <Route path="butchery" element={<Only roles={["admin", "cashier", "butcher"]}><Butchery /></Only>} />
          <Route path="stock" element={<Stock />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="more" element={<More />} />
          <Route path="dashboard" element={<Only roles={["admin", "cashier"]}><Dashboard /></Only>} />
          <Route path="menu" element={<Only roles={["admin"]}><Menu /></Only>} />
          <Route path="raw-items" element={<Only roles={["admin"]}><RawItems /></Only>} />
          <Route path="team" element={<Only roles={["admin"]}><Team /></Only>} />
          <Route path="suppliers" element={<Only roles={["admin"]}><Suppliers /></Only>} />
          <Route path="audit" element={<Only roles={["admin"]}><Audit /></Only>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
