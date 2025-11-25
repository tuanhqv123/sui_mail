import {
  Inbox,
  Send,
  Settings,
  Pencil,
  LogOut,
  CheckSquare,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/useStore";
import {
  useCurrentAccount,
  useDisconnectWallet,
  useResolveSuiNSName,
} from "@mysten/dapp-kit";

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar = ({ onItemClick }: SidebarProps) => {
  const logout = useAuthStore((state) => state.logout);
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  const navItems = [
    { to: "/compose", icon: Pencil, label: "Compose" },
    { to: "/tasks", icon: CheckSquare, label: "Tasks" },
    { to: "/inbox", icon: Inbox, label: "Inbox" },
    { to: "/sent", icon: Send, label: "Sent" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const handleDisconnect = () => {
    disconnect();
    logout();
    if (onItemClick) onItemClick();
  };

  return (
    <div className="w-64 h-full bg-primary rounded-r-3xl md:rounded-[2rem] flex flex-col py-6 px-2 md:px-6 shadow-sm">
      <div className="flex items-center justify-center">
        <div className="flex items-center w-full mb-4 justify-start">
          <div className="w-14 h-14 flex items-center justify-center">
            <img
              src="/jellyfish.png"
              alt="Jellyfish Logo"
              className="w-full h-full object-contain drop-shadow-lg"
              style={{ transform: "rotate(10deg)" }}
            />
          </div>
          <span
            className="font-extrabold text-4xl bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 bg-clip-text text-transparent tracking-wide animate-pulse"
            style={{
              fontFamily: '"Pacifico", "Comic Sans MS", cursive, sans-serif',
            }}
          >
            Jessea
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onItemClick}
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
        {currentAccount && (
          <button
            onClick={handleDisconnect}
            className="w-full bg-white flex items-center justify-start gap-2 px-8 py-3 rounded-full text-black hover:bg-hover hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            <SidebarAccountDisplay address={currentAccount.address} />
          </button>
        )}
      </div>
    </div>
  );
};

function SidebarAccountDisplay({ address }: { address: string }) {
  const { data, isPending } = useResolveSuiNSName(address);

  if (isPending) {
    return <span className="font-medium text-sm">Loading...</span>;
  }

  if (data) {
    return <span className="font-medium text-sm">{data}</span>;
  }

  return (
    <span className="font-medium text-sm">{`${address.slice(
      0,
      6
    )}...${address.slice(-4)}`}</span>
  );
}

export default Sidebar;
