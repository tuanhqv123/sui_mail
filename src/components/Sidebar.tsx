import { Inbox, Send, Settings, LogOut, Pencil } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/useStore";

const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    { to: "/compose", icon: Pencil, label: "Compose" },
    { to: "/inbox", icon: Inbox, label: "Inbox" },
    { to: "/sent", icon: Send, label: "Sent" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-64 h-full bg-primary rounded-[2rem] flex flex-col py-6 px-6 shadow-sm">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
          <span className="text-primary font-bold text-xl">S</span>
        </div>
        <span className="text-xl font-bold text-black">Sui Mail</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-white text-black shadow-sm font-semibold"
                  : "text-black hover:bg-white/60 hover:text-black"
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <button
          onClick={logout}
          className="w-full bg-white flex items-center gap-3 px-4 py-3 rounded-full text-black hover:bg-hover hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
