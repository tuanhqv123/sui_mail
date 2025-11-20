import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import Login from "./pages/Login";
import Inbox from "./pages/Inbox";
import Sent from "./pages/Sent";
import Settings from "./pages/Settings";
import Compose from "./pages/Compose";
import Sidebar from "./components/Sidebar";
import { useAuthStore } from "./store/useStore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const Layout = () => {
  return (
    <div className="flex h-screen bg-[#cce5ff] p-4 gap-4 overflow-hidden">
      <Sidebar />
      <div className="flex-1 bg-content rounded-[2rem] border-[2px] border-black overflow-auto shadow-sm">
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/sent" element={<Sent />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/" element={<Navigate to="/inbox" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
