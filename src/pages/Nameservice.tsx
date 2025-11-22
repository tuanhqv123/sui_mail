import { useState, useEffect } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  Loader2,
  Plus,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import Button from "../components/Button";

interface DomainInfo {
  name: string;
  fullName: string;
  years: number;
  created: boolean;
  transactionDigest?: string;
  error?: string;
}

const Nameservice = () => {
  const [domainInput, setDomainInput] = useState("");
  const [years, setYears] = useState(1);
  const [loading, setLoading] = useState(false);
  const [registeredDomains, setRegisteredDomains] = useState<DomainInfo[]>([]);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const validateDomainName = (name: string): boolean => {
    // Basic validation: lowercase letters, numbers, and hyphens
    // Length between 3 and 63 characters for domains
    const nameRegex = /^[a-z0-9-]{3,63}$/;
    return nameRegex.test(name) && !name.startsWith("-") && !name.endsWith("-");
  };

  const handleRegisterDomain = async () => {
    if (!currentAccount) {
      alert("Please connect your wallet first");
      return;
    }

    const cleanName = domainInput.trim().toLowerCase();
    if (!cleanName) {
      alert("Please enter a domain name");
      return;
    }

    if (!validateDomainName(cleanName)) {
      alert(
        "Domain name must be 3-63 characters, lowercase letters, numbers, and hyphens only, and cannot start or end with a hyphen"
      );
      return;
    }

    const fullDomainName = `${cleanName}.sui`;

    setLoading(true);

    const domainInfo: DomainInfo = {
      name: cleanName,
      fullName: fullDomainName,
      years: years,
      created: false,
    };

    try {
      console.log("Registering domain with:", {
        domain: fullDomainName,
        years: years,
        owner: currentAccount.address,
      });

      // Create a simple transaction for demo purposes
      const tx = new Transaction();
      tx.setSender(currentAccount.address);

      // For now, just simulate domain registration with a simple transaction
      // In a real implementation, this would include the actual SuiNS contract calls
      console.log("📝 Note: This is a demo implementation");
      console.log("📝 In production, this would:");
      console.log("  1. Call SuiNS registration contract");
      console.log("  2. Pay registration fee in SUI");
      console.log("  3. Transfer domain NFT to owner");

      // Create a simple transaction to demonstrate wallet interaction
      tx.transferObjects([tx.gas], tx.pure.address(currentAccount.address));

      // Execute transaction
      const response = await new Promise((resolve, reject) => {
        signAndExecute(
          {
            transaction: tx as any,
          },
          {
            onSuccess: (result: any) => resolve(result),
            onError: (error) => reject(error),
          }
        );
      });

      console.log("Transaction result:", response);

      domainInfo.created = true;
      domainInfo.transactionDigest = (response as any).digest;

      // Add to registered domains list
      setRegisteredDomains((prev) => [domainInfo, ...prev]);

      // Clear input
      setDomainInput("");
      setYears(1);

      alert(`Demo: Transaction completed for ${fullDomainName} registration`);
      alert(
        `Note: This is a demo implementation. The domain is not actually registered on SuiNS.`
      );
    } catch (error) {
      console.error("Failed to register domain:", error);
      domainInfo.error =
        error instanceof Error ? error.message : "Unknown error";

      alert(`Demo failed: ${domainInfo.error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRegisterDomain();
    }
  };

  if (loading && registeredDomains.length === 0) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">SuiNS Name Service</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-yellow-600 font-medium">
            🚧 Demo Mode
          </span>
          <span className="text-sm text-gray-600">
            Registration not implemented yet
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-6">
        {/* Demo Notice */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <h3 className="text-blue-800 font-semibold mb-2">
            Demo Implementation
          </h3>
          <p className="text-sm text-blue-700">
            This is a demonstration of the UI. Actual SuiNS domain registration
            requires:
          </p>
          <ul className="text-sm text-blue-700 space-y-1 mt-2">
            <li>• Official SuiNS SDK integration</li>
            <li>• Payment processing in SUI</li>
            <li>• Contract interaction for domain registration</li>
            <li>• NFT transfer to domain owner</li>
          </ul>
          <p className="text-sm text-blue-600 mt-3">
            Current implementation shows wallet transaction flow only.
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-black mb-2">
              Register New .sui Domain
            </h2>
            <p className="text-sm text-gray-600">
              Choose a name and duration for your domain
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Enter domain name (e.g., myname)"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className="w-full text-normal py-2 border-b border-gray focus:outline-none focus:border-none transition-colors placeholder:text-gray-400"
              />
              {domainInput && (
                <p className="text-sm text-gray-500 mt-2">
                  Your domain will be:{" "}
                  <span className="font-mono text-blue-600">
                    {domainInput.toLowerCase()}.sui
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Duration
                </label>
                <select
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  disabled={loading}
                  className="w-full mt-1 px-3 py-2 border border-gray rounded-lg focus:outline-none focus:border-none transition-colors"
                >
                  <option value={1}>1 year</option>
                  <option value={2}>2 years</option>
                  <option value={3}>3 years</option>
                  <option value={4}>4 years</option>
                  <option value={5}>5 years</option>
                </select>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600">Demo Cost</p>
                <p className="text-lg font-semibold text-black">Free</p>
              </div>
            </div>

            {/* Validation hints */}
            {domainInput && (
              <div className="text-sm">
                {validateDomainName(domainInput) ? (
                  <p className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={14} />
                    Valid domain name
                  </p>
                ) : (
                  <p className="text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Must be 3-63 characters, lowercase letters, numbers, and
                    hyphens only
                  </p>
                )}
              </div>
            )}

            {!currentAccount && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Please connect your wallet to continue
                </p>
              </div>
            )}

            <Button
              onClick={handleRegisterDomain}
              disabled={loading || !domainInput.trim() || !currentAccount}
              className="w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing Demo...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Try Demo Registration
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Registered Domains */}
        {registeredDomains.length > 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray">
            <h2 className="text-xl font-semibold text-black mb-4">
              Demo Transactions
            </h2>

            <div className="space-y-2">
              {registeredDomains.map((domain, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-2xl border ${
                    domain.created
                      ? "border-blue-200 bg-blue-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3
                        className={`font-medium ${
                          domain.created ? "text-blue-800" : "text-red-800"
                        }`}
                      >
                        {domain.fullName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {domain.created
                          ? `Demo transaction for ${domain.years} year(s)`
                          : "Demo failed"}
                      </p>
                      {domain.error && (
                        <p className="text-sm text-red-600 mt-1">
                          {domain.error}
                        </p>
                      )}
                    </div>

                    {domain.created && domain.transactionDigest && (
                      <a
                        href={`https://explorer.sui.io/tx/${domain.transactionDigest}?network=testnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink size={14} />
                        View Transaction
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Nameservice;
