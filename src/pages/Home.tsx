import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Cloud, Star, MessageCircle, Bot, Filter, Send } from "lucide-react";
import jellyfishCurious from "../assets/jellyfish_emo_curious.png";
import jellyfishSealWalrus from "../assets/jellyfish_walrus_seal_talk.png";
import jellyfishHappy from "../assets/jellyfish_emo_happly.png";
import jellyfishSend from "../assets/jellyfish_act_sendmail.png";
import sealMascot from "../assets/seal-mascot.svg";
import walrusLogo from "../assets/walrus_logo.jpg";
import suiLogo from "../assets/Sui_Symbol_Sea.png";
import { ScrollReveal, Parallax, FloatingElements } from "../components/ScrollAnimations";

const Home = () => {
     const [loaded, setLoaded] = useState(false);
     const [showLogo, setShowLogo] = useState(true);
     const lastScrollY = useRef(0);

     useEffect(() => {
          const handleScroll = () => {
               const currentScrollY = window.scrollY;
               if (currentScrollY > lastScrollY.current && currentScrollY > 40) {
                    // Scrolling down
                    setShowLogo(false);
               } else {
                    // Scrolling up
                    setShowLogo(true);
               }
               lastScrollY.current = currentScrollY;
          };
          window.addEventListener("scroll", handleScroll);
          return () => window.removeEventListener("scroll", handleScroll);
     }, []);
     const navigate = useNavigate();

     useEffect(() => {
          setLoaded(true);
     }, []);

     const handleStartMessaging = () => {
          navigate("/login");
     };

     return (
          <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 overflow-x-hidden">
               {/* Sticky Logo in Top Left, hide on scroll down, show on scroll up */}
               <div
                    className={`fixed top-4 left-4 z-50 flex items-center px-4 py-2 transition-transform duration-500 ${
                         showLogo ? "translate-y-0 opacity-100" : "-translate-y-32 opacity-0 pointer-events-none"
                    }`}
               >
                    <div className="w-20 h-20 flex items-center justify-center">
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
               {/* Enhanced Background with Ocean Depth */}
               <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-100/20 to-blue-200/30" />
                    <FloatingElements />

                    {/* Deep sea wave effect layers */}
                    <div className="absolute top-0 left-0 w-full h-full">
                         <div className="absolute top-40 left-20 w-64 h-64 bg-blue-300/20 rounded-full filter blur-3xl-enhanced animate-wave-slow" />
                         <div
                              className="absolute top-80 right-32 w-96 h-96 bg-indigo-300/15 rounded-full filter blur-3xl-enhanced animate-wave-slow"
                              style={{ animationDelay: "4s" }}
                         />
                         <div
                              className="absolute bottom-40 left-1/2 w-80 h-80 bg-cyan-300/25 rounded-full filter blur-3xl-enhanced animate-wave-slow"
                              style={{ animationDelay: "8s" }}
                         />
                         <div
                              className="absolute top-1/3 left-1/4 w-72 h-72 bg-purple-300/10 rounded-full filter blur-3xl-enhanced animate-wave-slow"
                              style={{ animationDelay: "12s" }}
                         />
                    </div>
               </div>

               {/* Hero Section */}
               <section className="relative min-h-screen flex items-center justify-center px-4 pt-10 pb-4 overflow-hidden">
                    <div
                         className={`max-w-7xl mx-auto text-center transition-all duration-1500 transform ${
                              loaded ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
                         }`}
                    >
                         {/* Jellyfish Communications Hub */}
                         <Parallax speed={0.2}>
                              <ScrollReveal direction="down" delay={300}>
                                   <div className="mb-12 relative">
                                        <div className="relative inline-block">
                                             <img
                                                  src={jellyfishSealWalrus}
                                                  alt="Jessea Communication Hub"
                                                  className="w-128 h-128 mx-auto drop-shadow-2xl"
                                             />
                                        </div>
                                   </div>
                              </ScrollReveal>
                         </Parallax>

                         {/* Main Headline */}
                         <ScrollReveal direction="up" delay={500}>
                              <div className="my-8">
                                   <p className="text-xl md:text-2xl text-gray-700 font-medium max-w-4xl mx-auto leading-relaxed">
                                        Experience pure fluid encrypted communication and workflow on the Sui blockchain
                                        with Seal and Walrus.
                                   </p>
                              </div>
                         </ScrollReveal>

                         {/* CTA Button - Absolutely positioned at bottom of hero section */}
                         <ScrollReveal direction="up" delay={700}>
                              <div
                                   className="absolute left-1/2 bottom-100 -translate-x-1/2 z-30 flex justify-center items-center w-full"
                                   style={{ pointerEvents: "auto" }}
                              >
                                   <button
                                        onClick={handleStartMessaging}
                                        className="group px-16 py-6 bg-white text-black font-black text-2xl border-4 border-black rounded-2xl shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-3 hover:translate-y-3 transition-all duration-500 transform max-w-full"
                                        style={{ minWidth: "220px" }}
                                   >
                                        Ready to Dive In
                                   </button>
                              </div>
                         </ScrollReveal>
                    </div>

                    {/* Ocean Scroll Indicator */}
                    <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce"></div>
               </section>

               {/* Core Features - Paper Notes Style */}
               <section className="relative py-32 px-4">
                    <div className="max-w-7xl mx-auto">
                         {/* Random Jellyfish Decorations */}
                         <div className="absolute top-10 left-5 w-16 h-16 opacity-30 animate-float-slow">
                              <img src={jellyfishCurious} alt="Jellyfish" className="w-full h-full" />
                         </div>
                         <div
                              className="absolute top-32 right-8 w-20 h-20 opacity-25 animate-float-slow"
                              style={{ animationDelay: "3s" }}
                         >
                              <img src={sealMascot} alt="Seal" className="w-full h-full" />
                         </div>
                         <div
                              className="absolute bottom-20 left-1/4 w-14 h-14 opacity-35 animate-float-slow"
                              style={{ animationDelay: "6s" }}
                         >
                              <img src={jellyfishSealWalrus} alt="Jellyfish" className="w-full h-full" />
                         </div>

                         <ScrollReveal direction="up">
                              <div className="text-center mb-24">
                                   <h2 className="text-6xl md:text-8xl font-black text-gray-900 mb-8">
                                        Why Choose
                                        <span className="text-cyan-600"> Jessea</span>
                                   </h2>
                                   <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
                                        The decentralized communication platform that puts your privacy first, powered
                                        by Sui blockchain and intelligent communication tools
                                   </p>
                              </div>
                         </ScrollReveal>

                         {/* Paper Notes Grid */}
                         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                              {/* Wave Background Effect */}
                              <div className="absolute inset-0 pointer-events-none">
                                   <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-100/20 via-blue-100/10 to-indigo-100/20 blur-3xl-enhanced animate-wave-slow" />
                              </div>

                              {/* Paper Note 1 */}
                              <ScrollReveal direction="left" delay={200}>
                                   <div className="relative group">
                                        {/* Paper texture background */}
                                        <div className="absolute inset-0 bg-yellow-50/90 border-4 border-black rounded-lg transform rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" />
                                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 border-2 border-black" />
                                        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-500 border-2 border-black" />

                                        {/* Content */}
                                        <div className="relative p-6 bg-white/95 backdrop-blur-sm border-4 border-black rounded-lg transform hover:-translate-y-2 hover:rotate-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                                             <img src={jellyfishHappy} alt="Happy" className="w-12 h-12 mx-auto mb-4" />
                                             <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">
                                                  END-TO-END ENCRYPTED
                                             </h3>
                                             <div className="w-full h-px bg-black mb-2" />
                                             <p className="text-sm text-gray-800 leading-relaxed font-mono">
                                                  Military-grade Seal encryption ensures only members can access to your
                                                  shared data. No one else.
                                             </p>
                                             <div className="mt-3 flex gap-1">
                                                  <div className="w-2 h-2 bg-black" />
                                                  <div className="w-2 h-2 bg-gray-400" />
                                                  <div className="w-2 h-2 bg-black" />
                                             </div>
                                        </div>
                                   </div>
                              </ScrollReveal>

                              {/* Paper Note 2 */}
                              <ScrollReveal direction="up" delay={400}>
                                   <div className="relative group">
                                        {/* Paper texture background */}
                                        <div className="absolute inset-0 bg-yellow-50/90 border-4 border-black rounded-lg transform -rotate-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" />
                                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-cyan-500 border-2 border-black" />
                                        <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-green-500 border-2 border-black" />

                                        {/* Content */}
                                        <div className="relative p-6 bg-white/95 backdrop-blur-sm border-4 border-black rounded-lg transform hover:-translate-y-2 hover:rotate-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                                             <img src={jellyfishSend} alt="Send" className="w-12 h-12 mx-auto mb-4" />
                                             <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">
                                                  HUMAN-FRIENDLY NAME
                                             </h3>
                                             <div className="w-full h-px bg-black mb-2" />
                                             <p className="text-sm text-gray-800 leading-relaxed font-mono">
                                                  Communicate with @name.sui instead of complicated wallet addresses.
                                                  Easy to remember, impossible to forget.
                                             </p>
                                             <div className="mt-3 flex gap-1">
                                                  <div className="w-2 h-2 bg-black" />
                                                  <div className="w-2 h-2 bg-gray-400" />
                                                  <div className="w-2 h-2 bg-black" />
                                             </div>
                                        </div>
                                   </div>
                              </ScrollReveal>

                              {/* Paper Note 3 */}
                              <ScrollReveal direction="up" delay={600}>
                                   <div className="relative group">
                                        {/* Paper texture background */}
                                        <div className="absolute inset-0 bg-yellow-50/90 border-4 border-black rounded-lg transform rotate-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" />
                                        <div className="absolute -top-2 -right-1 w-4 h-4 bg-purple-500 border-2 border-black" />
                                        <div className="absolute -bottom-1 -left-2 w-3 h-3 bg-orange-500 border-2 border-black" />

                                        {/* Content */}
                                        <div className="relative p-6 bg-white/95 backdrop-blur-sm border-4 border-black rounded-lg transform hover:-translate-y-2 hover:rotate-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                                             <img src={jellyfishHappy} alt="AI" className="w-12 h-12 mx-auto mb-4" />
                                             <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">
                                                  AI ASSISTANT
                                             </h3>
                                             <div className="w-full h-px bg-black mb-2" />
                                             <p className="text-sm text-gray-800 leading-relaxed font-mono">
                                                  Smart AI helps you compose better contents and improve your
                                                  communication style. Like magic.
                                             </p>
                                             <div className="mt-3 flex gap-1">
                                                  <div className="w-2 h-2 bg-black" />
                                                  <div className="w-2 h-2 bg-gray-400" />
                                                  <div className="w-2 h-2 bg-black" />
                                             </div>
                                        </div>
                                   </div>
                              </ScrollReveal>

                              {/* Paper Note 4 */}
                              <ScrollReveal direction="right" delay={800}>
                                   <div className="relative group">
                                        {/* Paper texture background */}
                                        <div className="absolute inset-0 bg-yellow-50/90 border-4 border-black rounded-lg transform -rotate-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" />
                                        <div className="absolute -top-1 -left-2 w-4 h-4 bg-pink-500 border-2 border-black" />
                                        <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-yellow-500 border-2 border-black" />

                                        {/* Content */}
                                        <div className="relative p-6 bg-white/95 backdrop-blur-sm border-4 border-black rounded-lg transform hover:-translate-y-2 hover:rotate-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                                             <img
                                                  src={jellyfishCurious}
                                                  alt="Protection"
                                                  className="w-12 h-12 mx-auto mb-4"
                                             />
                                             <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">
                                                  SPAM PROTECTION
                                             </h3>
                                             <div className="w-full h-px bg-black mb-2" />
                                             <p className="text-sm text-gray-800 leading-relaxed font-mono">
                                                  Advanced permission system keeps unwanted messages away while ensuring
                                                  important communications get through.
                                             </p>
                                             <div className="mt-3 flex gap-1">
                                                  <div className="w-2 h-2 bg-black" />
                                                  <div className="w-2 h-2 bg-gray-400" />
                                                  <div className="w-2 h-2 bg-black" />
                                             </div>
                                        </div>
                                   </div>
                              </ScrollReveal>
                         </div>
                    </div>
               </section>

               {/* Technology Showcase */}
               <section className="relative py-32 px-4">
                    <div className="max-w-6xl mx-auto">
                         <ScrollReveal direction="up">
                              <div className="text-center mb-24">
                                   <h2 className="text-6xl md:text-8xl font-black text-gray-900 mb-8">
                                        Built on Sui Ecosystem
                                   </h2>
                                   <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
                                        Powered by the most advanced privacy technologies in the Web3 space
                                   </p>
                              </div>
                         </ScrollReveal>

                         <div className="grid md:grid-cols-3 gap-12 mb-24">
                              {/* Sui */}
                              <ScrollReveal direction="left" delay={200}>
                                   <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-4 border-black rounded-3xl p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all duration-400 transform">
                                        <div className="w-24 h-24 flex items-center justify-center mb-6 mx-auto">
                                             <img src={suiLogo} alt="Sui blockchain" className="h-[75px] mx-auto" />
                                        </div>
                                        <h3 className="text-3xl font-black text-gray-900 mb-4 text-center">
                                             Sui Blockchain
                                        </h3>
                                        <p className="text-gray-700 leading-relaxed text-center text-lg">
                                             Lightning-fast transactions, low fees, and developer-friendly smart
                                             contracts for seamless communication.
                                        </p>
                                   </div>
                              </ScrollReveal>

                              {/* Seal */}
                              <ScrollReveal direction="up" delay={400}>
                                   <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-4 border-black rounded-3xl p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all duration-400 transform">
                                        <img src={sealMascot} alt="Seal Privacy" className="w-24 h-24 mx-auto mb-6" />
                                        <h3 className="text-3xl font-black text-gray-900 mb-4 text-center">
                                             Seal Privacy
                                        </h3>
                                        <p className="text-gray-700 leading-relaxed text-center text-lg">
                                             Revolutionary encryption technology that keeps your messages completely
                                             private and tamper-proof.
                                        </p>
                                   </div>
                              </ScrollReveal>

                              {/* Walrus */}
                              <ScrollReveal direction="right" delay={600}>
                                   <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-4 border-black rounded-3xl p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all duration-400 transform">
                                        <div className="w-24 h-24 flex items-center justify-center mb-6 mx-auto">
                                             <img
                                                  src={walrusLogo}
                                                  alt="Walrus Storage"
                                                  className="h-[75px] mx-auto rounded-md"
                                             />
                                        </div>
                                        <h3 className="text-3xl font-black text-gray-900 mb-4 text-center">
                                             Walrus Storage
                                        </h3>
                                        <p className="text-gray-700 leading-relaxed text-center text-lg">
                                             Decentralized storage solution ensuring your messages are always available
                                             and never censored.
                                        </p>
                                   </div>
                              </ScrollReveal>
                         </div>
                    </div>
               </section>

               {/* Jessea Roadmap */}
               <section className="relative py-32 px-4">
                    <div className="max-w-6xl mx-auto">
                         <ScrollReveal direction="up">
                              <div className="text-center mb-24">
                                   <h2 className="text-6xl md:text-8xl font-black text-cyan-600 mb-8">
                                        Jessea
                                        <span className="text-gray-900"> Roadmap</span>
                                   </h2>
                                   <p className="text-2xl font-bold text-gray-900 mb-12">
                                        Enhance teamwork, eliminate security incidents, and save millions
                                   </p>
                                   <div className="max-w-7xl mx-auto">
                                        <div className="bg-white border-4 border-black rounded-3xl p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                                             <div className="space-y-6 max-w-4xl mx-auto">
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-cyan-500 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Eliminate silos by integrating key operations into a single,
                                                            unified workspace
                                                       </p>
                                                  </div>
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-blue-500 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Co-edit docs in real time - perfect for iterating product
                                                            specs and whitepapers
                                                       </p>
                                                  </div>
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-indigo-500 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Automate approvals to streamline workflows and shorten
                                                            customer waiting times
                                                       </p>
                                                  </div>
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-blue-600 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Automate routine tasks to free up teams for high-impact work
                                                            like token launches
                                                       </p>
                                                  </div>
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-indigo-600 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Avoid leaks with document permissions, mobile encryption,
                                                            and sensitive word filters
                                                       </p>
                                                  </div>
                                                  <div className="flex items-start gap-4">
                                                       <div className="w-5 h-5 bg-purple-600 border-2 border-black rounded-full flex-shrink-0 mt-1" />
                                                       <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                                                            Protect sensitive data with secure labels, watermark
                                                            management, and device access controls
                                                       </p>
                                                  </div>
                                             </div>
                                        </div>
                                   </div>
                              </div>
                         </ScrollReveal>
                    </div>
               </section>
          </div>
     );
};

export default Home;
