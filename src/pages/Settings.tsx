import { useState, useEffect } from "react";
import Button from "../components/Button";
import { X, Loader2 } from "lucide-react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { SuiMailService } from "../services/suiService";

const Settings = () => {
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const suiMailService = new SuiMailService(suiClient);

  useEffect(() => {
    if (currentAccount) {
      loadProfile();
    }
  }, [currentAccount]);

  const loadProfile = async () => {
    if (!currentAccount) return;

    try {
      const profile = await suiMailService.getUserProfile(
        currentAccount.address
      );

      if (profile && profile.data) {
        setHasProfile(true);
        setProfileId(profile.data.objectId);

        // Load blocked users from the profile
        await loadBlacklist(profile.data.objectId);
      } else {
        setHasProfile(false);
        setBlacklist([]);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      setBlacklist([]);
    }
  };

  const loadBlacklist = async (profileObjectId: string) => {
    try {
      const blockedUsers = await suiMailService.getBlacklistedUsers(
        profileObjectId
      );
      setBlacklist(blockedUsers);
    } catch (error) {
      console.error("Failed to load blacklist:", error);
      setBlacklist([]);
    }
  };

  const handleCreateProfile = async () => {
    if (!currentAccount) {
      alert("Please connect your wallet");
      return;
    }

    setLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        suiMailService.createProfile(async (input) => {
          return new Promise((resolveInner, rejectInner) => {
            signAndExecute(
              { transaction: input.transaction as any },
              {
                onSuccess: (result) => {
                  resolveInner({ digest: result.digest });
                  resolve();
                },
                onError: (error) => {
                  rejectInner(error);
                  reject(error);
                },
              }
            );
          });
        });
      });

      alert("Profile created successfully!");
      await loadProfile();
    } catch (error) {
      console.error("Failed to create profile:", error);
      alert("Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlacklist = async () => {
    if (!blacklistInput.trim() || !profileId) {
      alert("Please enter an address to blacklist");
      return;
    }

    setLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        suiMailService.blacklistUser(
          profileId,
          blacklistInput,
          async (input) => {
            return new Promise((resolveInner, rejectInner) => {
              signAndExecute(
                { transaction: input.transaction as any },
                {
                  onSuccess: (result) => {
                    resolveInner({ digest: result.digest });
                    resolve();
                  },
                  onError: (error) => {
                    rejectInner(error);
                    reject(error);
                  },
                }
              );
            });
          }
        );
      });

      setBlacklist([...blacklist, blacklistInput.trim()]);
      setBlacklistInput("");
      alert("User blacklisted successfully!");
    } catch (error) {
      console.error("Failed to blacklist user:", error);
      alert("Failed to blacklist user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBlacklist = async (address: string) => {
    if (!profileId) return;

    setLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        suiMailService.removeFromBlacklist(
          profileId,
          address,
          async (input) => {
            return new Promise((resolveInner, rejectInner) => {
              signAndExecute(
                { transaction: input.transaction as any },
                {
                  onSuccess: (result) => {
                    resolveInner({ digest: result.digest });
                    resolve();
                  },
                  onError: (error) => {
                    rejectInner(error);
                    reject(error);
                  },
                }
              );
            });
          }
        );
      });

      setBlacklist(blacklist.filter((i) => i !== address));
      alert("User removed from blacklist!");
    } catch (error) {
      console.error("Failed to remove from blacklist:", error);
      alert("Failed to remove from blacklist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-full">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences</p>
      </header>

      <div className="max-w-2xl bg-muted rounded-2xl space-y-6">
        <div className="p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile</h3>
          {!hasProfile ? (
            <div>
              <p className="text-gray-600 mb-4">
                You don't have a profile yet. Create one to start using Sui
                Mail.
              </p>
              <Button onClick={handleCreateProfile} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Profile</span>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img
                src={`https://api.dicebear.com/9.x/glass/svg?seed=${
                  currentAccount?.address || ""
                }`}
                alt="avatar"
                className="w-16 h-16 rounded-xl flex-shrink-0"
              />
              <div>
                <p className="text-sm text-gray-600">Address:</p>
                <p className="font-mono text-sm">
                  {currentAccount?.address.slice(0, 10)}...
                  {currentAccount?.address.slice(-8)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Blacklist
          </h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              placeholder="Enter address to block (0x...)"
              className="flex-1 px-4 py-2 rounded-full border border-gray-200 outline-none focus:border-none transition-colors"
            />
            <Button
              onClick={handleAddBlacklist}
              disabled={!blacklistInput.trim() || !hasProfile || loading}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "Block"
              )}
            </Button>
          </div>

          {blacklist.length > 0 && (
            <div className="space-y-2">
              {blacklist.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700 font-mono text-sm">
                    {item.slice(0, 10)}...{item.slice(-8)}
                  </span>
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
