import { useAuthStore } from "../store/useStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

const Login = () => {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();

  useEffect(() => {
    if (currentAccount) {
      login();
      navigate("/inbox");
    }
  }, [currentAccount, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Welcome to Sui Mail
          </h1>
          <p className="text-gray-500">Connect your wallet to continue</p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <ConnectButton className="!w-full !bg-primary hover:!bg-blue-400 !text-white !font-bold !py-3 !rounded-xl !transition-colors !shadow-md hover:!shadow-lg" />

          <div className="text-center text-sm text-gray-500 mt-4">
            <p>Don't have a wallet?</p>
            <a
              href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Install Sui Wallet
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
