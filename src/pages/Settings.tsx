import { useState } from "react";
import Button from "../components/Button";
import { X } from "lucide-react";

const Settings = () => {
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklist, setBlacklist] = useState<string[]>([]);

  const handleAddBlacklist = () => {
    if (blacklistInput.trim()) {
      setBlacklist([...blacklist, blacklistInput.trim()]);
      setBlacklistInput("");
    }
  };

  const handleRemoveBlacklist = (item: string) => {
    setBlacklist(blacklist.filter((i) => i !== item));
  };

  return (
    <div className="p-8 h-full">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences</p>
      </header>

      <div className="max-w-2xl space-y-6">
        <div className="p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
              S
            </div>
            <div>
              <button className="text-primary font-medium hover:underline">
                Change Avatar
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Appearance
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Theme</span>
            <select className="px-4 py-2 rounded-lg border border-gray-200 outline-none focus:border-primary">
              <option>Light</option>
              <option>Dark</option>
              <option>System</option>
            </select>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Blacklist
          </h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              placeholder="Enter email or domain to block"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 outline-none focus:border-black transition-colors"
            />
            <Button
              onClick={handleAddBlacklist}
              disabled={!blacklistInput.trim()}
            >
              Save
            </Button>
          </div>

          {blacklist.length > 0 && (
            <div className="space-y-2">
              {blacklist.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700">{item}</span>
                  <button
                    onClick={() => handleRemoveBlacklist(item)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
