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
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 overflow-hidden">
               {/* Background elements */}
               <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-20 left-20 w-32 h-32 bg-cyan-200 rounded-full mix-blend-multiply filter blur-2xl opacity-60 animate-pulse" />
                    <div
                         className="absolute top-40 right-20 w-48 h-48 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-60 animate-pulse"
                         style={{ animationDelay: "2s" }}
                    />
                    <div
                         className="absolute bottom-20 left-1/2 w-40 h-40 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-60 animate-pulse"
                         style={{ animationDelay: "4s" }}
                    />
               </div>

               <div className="relative z-10 w-full max-w-4xl mx-auto p-8">
                    <div className="bg-white border-4 border-black rounded-3xl shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-12">
                         {/* Logo Section */}
                         <div className="text-center mb-12">
                              <div className="flex items-center justify-center mb-6">
                                   <div className="w-16 h-16 flex items-center justify-center mr-4">
                                        <img
                                             src="/jellyfish.png"
                                             alt="Jellyfish Logo"
                                             className="w-full h-full object-contain drop-shadow-lg"
                                             style={{ transform: "rotate(10deg)" }}
                                        />
                                   </div>
                                   <h1
                                        className="font-extrabold text-4xl bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 bg-clip-text text-transparent tracking-wide animate-pulse"
                                        style={{
                                             fontFamily: '"Pacifico", "Comic Sans MS", cursive, sans-serif',
                                        }}
                                   >
                                        Jessea
                                   </h1>
                              </div>
                              <p className="text-xl text-gray-700 font-medium">
                                   Connect your wallet to dive into fluidity
                              </p>
                         </div>

                         {/* Connect Button */}
                         <div className="flex flex-col items-center space-y-8">
                              <ConnectButton
                                   connectText="Connect Wallet"
                                   className="!w-full !max-w-md !px-8 !py-6 !bg-secondary !text-gray-900 !font-black !text-xl !border-4 !border-black !rounded-2xl !shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:!bg-muted hover:!text-gray-900 hover:!shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:!translate-x-2 hover:!translate-y-2 !transition-all !duration-300"
                              />

                              {/* Help Text */}
                              <div className="text-center text-gray-600 space-y-2">
                                   <p className="font-medium">Need a wallet?</p>
                                   <a
                                        href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block px-6 py-2 bg-white border-2 border-black rounded-full font-bold text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
                                   >
                                        Get Sui Wallet
                                   </a>
                              </div>
                         </div>
                    </div>
               </div>
          </div>
     );
};

export default Login;
