import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { Menu } from "lucide-react";
import { useState } from "react";
import Login from "./pages/Login";
import Inbox from "./pages/Inbox";
import Sent from "./pages/Sent";
import Settings from "./pages/Settings";
import Compose from "./pages/Compose";
import Sidebar from "./components/Sidebar";
import ChatBubble from "./components/ChatBubble";
import { useAuthStore } from "./store/useStore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-secondary p-4 gap-4 overflow-hidden relative">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      {/* Chat Bubble - Hidden on compose page */}
      {location.pathname !== "/compose" && <ChatBubble />}

      {/* Mobile Menu Button */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden fixed bottom-6 left-6 z-51 w-14 h-14 bg-white border-2 border-black text-black rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 hover:bg-gray-100"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Mobile Sidebar Overlay & Drawer */}
      {/* Only one mobile sidebar overlay! */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-transparent animate-in slide-in-from-left rounded-r-3xl duration-300">
            <Sidebar onItemClick={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

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
