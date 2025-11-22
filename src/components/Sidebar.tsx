import { Inbox, Send, Settings, Pencil } from "lucide-react";
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
    <div className="w-64 h-full bg-primary rounded-[2rem] flex flex-col py-6 px-6 shadow-sm">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center shadow-sm p-1">
          <img
            src="/Sui_Symbol_Sea.svg"
            alt="Sui Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-xl font-bold text-black">Sui Mail</span>
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
            className="w-full bg-white flex items-center justify-center px-4 py-3 rounded-full text-black hover:bg-hover hover:text-red-600 transition-colors"
          >
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
