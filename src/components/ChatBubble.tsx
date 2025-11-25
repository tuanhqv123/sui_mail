import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AI_CONFIG, makeAIChatRequest } from "../config/ai";
import { generateSystemPrompt } from "../config/prompts";
import { detectAndReplaceAddresses, parseTransferInstructions } from "../utils/addressDetection";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

interface Message {
     role: "user" | "assistant";
     content: string;
     timestamp: Date;
}

const ChatBubble = () => {
     const [isOpen, setIsOpen] = useState(false);
     const [messages, setMessages] = useState<Message[]>([]);
     const [input, setInput] = useState("");
     const [isLoading, setIsLoading] = useState(false);
     const messagesEndRef = useRef<HTMLDivElement>(null);
     const inputRef = useRef<HTMLTextAreaElement>(null);
     const transferExecutionRef = useRef<boolean>(false);

     const [currentApiKeyIndex, setCurrentApiKeyIndex] = useState(0);
     const [currentModelIndex, setCurrentModelIndex] = useState(0);
     const [error, setError] = useState<string | null>(null);

     // Transfer related state
     const [pendingTransfers, setPendingTransfers] = useState<Array<{
          amount: number;
          to: string;
     }> | null>(null);
     const [currentAddressMap, setCurrentAddressMap] = useState<Record<string, string>>({});
     const [isExecutingTransfer, setIsExecutingTransfer] = useState(false);

     // Sui hooks
     const account = useCurrentAccount();
     const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
     const suiClient = useSuiClient();

     // Mail and task data storage for AI context
     const mailDataStorage = useRef<{
          inbox: any[];
          sent: any[];
          currentMail: any;
          tasks: any[];
          allowlists: any[];
          lastUpdated: number;
     }>({
          inbox: [],
          sent: [],
          currentMail: null,
          tasks: [],
          allowlists: [],
          lastUpdated: 0,
     });

     // Update mail and task data from window object
     const updateMailDataFromWindow = () => {
          if (typeof window !== "undefined") {
               const currentEmail = (window as any).selectedEmail;
               const inboxMails = (window as any).inboxMails || [];
               const sentMails = (window as any).sentMails || [];
               const tasks = (window as any).tasksData || [];
               const allowlists = (window as any).allowlistsData || [];

               // Only update if there's new data
               if (
                    currentEmail !== mailDataStorage.current.currentMail ||
                    JSON.stringify(inboxMails) !== JSON.stringify(mailDataStorage.current.inbox) ||
                    JSON.stringify(sentMails) !== JSON.stringify(mailDataStorage.current.sent) ||
                    JSON.stringify(tasks) !== JSON.stringify(mailDataStorage.current.tasks) ||
                    JSON.stringify(allowlists) !== JSON.stringify(mailDataStorage.current.allowlists)
               ) {
                    mailDataStorage.current = {
                         inbox: inboxMails,
                         sent: sentMails,
                         currentMail: currentEmail,
                         tasks,
                         allowlists,
                         lastUpdated: Date.now(),
                    };
               }
          }
     };

     const switchToNextModel = () => {
          setCurrentModelIndex((prev) => (prev + 1) % AI_CONFIG.MODELS.length);
          setError(null);
     };

     const switchToNextApiKey = () => {
          setCurrentApiKeyIndex((prev) => (prev + 1) % AI_CONFIG.API_KEYS.length);
          setError(null);
     };

     const sendMessage = async () => {
          if (!input.trim()) return;

          const originalInput = input.trim();
          const { processedText, addressMap } = detectAndReplaceAddresses(originalInput);

          console.log("Address detection:", {
               originalInput,
               processedText,
               addressMap,
          });

          const userMessage: Message = {
               role: "user",
               content: originalInput, // Display original input
               timestamp: new Date(),
          };

          setMessages((prev) => [...prev, userMessage]);
          setInput("");
          setIsLoading(true);
          setError(null);
          setCurrentAddressMap(addressMap);

          try {
               // Update mail and task data from window before generating prompt
               updateMailDataFromWindow();

               const systemPrompt = generateSystemPrompt(mailDataStorage.current, account?.address);

               // Create API message with processed text (aliases instead of real addresses)
               const apiUserMessage = {
                    role: "user",
                    content: processedText, // Send processed text with aliases to AI
               };

               console.log("Sending to AI:", {
                    processedText,
                    addressMap,
                    systemPromptLength: systemPrompt.length,
               });

               const messagesForAPI = [
                    { role: "system", content: systemPrompt },
                    ...messages.slice(-10), // Keep last 10 messages for context
                    apiUserMessage,
               ];

               let success = false;
               let lastError: any = null;
               let apiKeyIndex = currentApiKeyIndex;
               let modelIndex = currentModelIndex;

               // Try with current configuration first
               try {
                    const response = await makeAIChatRequest(messagesForAPI, apiKeyIndex, modelIndex);
                    success = true;

                    let responseContent = response.choices[0]?.message?.content || "No response";

                    // Check for transfer instructions in the response
                    const transfers = parseTransferInstructions(responseContent);
                    if (transfers && transfers.length > 0) {
                         setPendingTransfers(transfers);
                         // Replace the raw JSON with a friendly message
                         const transferDetails = transfers
                              .map((t, idx) => `${idx + 1}. ${t.amount} SUI to ${addressMap[t.to] || t.to}`)
                              .join("\n");
                         responseContent = `I detected a transfer request!\n\n${transferDetails}\n\nExecuting transaction...`;

                         // Execute transfer after a short delay to ensure state is updated
                         setTimeout(() => {
                              if (account && suiClient && Object.keys(addressMap).length > 0) {
                                   console.log("Executing transfer from sendMessage:", {
                                        transfers,
                                        addressMap,
                                        account: account.address,
                                   });
                                   executeTransfer(transfers, addressMap);
                              } else {
                                   console.log("Cannot execute transfer - conditions not met:", {
                                        account: !!account,
                                        suiClient: !!suiClient,
                                        addressMapKeys: Object.keys(addressMap).length,
                                   });
                              }
                         }, 1000);
                    }

                    const assistantMessage: Message = {
                         role: "assistant",
                         content: responseContent,
                         timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
               } catch (err) {
                    lastError = err;

                    // Try switching model
                    modelIndex = (modelIndex + 1) % AI_CONFIG.MODELS.length;
                    setCurrentModelIndex(modelIndex);

                    try {
                         const response = await makeAIChatRequest(messagesForAPI, apiKeyIndex, modelIndex);
                         success = true;

                         let responseContent = response.choices[0]?.message?.content || "No response";

                         // Check for transfer instructions in the response
                         const transfers = parseTransferInstructions(responseContent);
                         if (transfers && transfers.length > 0) {
                              setPendingTransfers(transfers);
                              const transferDetails = transfers
                                   .map((t, idx) => `${idx + 1}. ${t.amount} SUI to ${addressMap[t.to] || t.to}`)
                                   .join("\n");
                              responseContent = `I detected a transfer request!\n\n${transferDetails}\n\nExecuting transaction...`;

                              // Execute transfer after a short delay to ensure state is updated
                              setTimeout(() => {
                                   if (account && suiClient && Object.keys(addressMap).length > 0) {
                                        console.log("Executing transfer from sendMessage (retry 1):", {
                                             transfers,
                                             addressMap,
                                             account: account.address,
                                        });
                                        executeTransfer(transfers, addressMap);
                                   }
                              }, 1000);
                         }

                         const assistantMessage: Message = {
                              role: "assistant",
                              content: responseContent,
                              timestamp: new Date(),
                         };
                         setMessages((prev) => [...prev, assistantMessage]);
                    } catch (err2) {
                         lastError = err2;

                         // Try switching API key
                         apiKeyIndex = (apiKeyIndex + 1) % AI_CONFIG.API_KEYS.length;
                         setCurrentApiKeyIndex(apiKeyIndex);

                         try {
                              const response = await makeAIChatRequest(messagesForAPI, apiKeyIndex, modelIndex);
                              success = true;

                              let responseContent = response.choices[0]?.message?.content || "No response";

                              // Check for transfer instructions in the response
                              const transfers = parseTransferInstructions(responseContent);
                              if (transfers && transfers.length > 0) {
                                   setPendingTransfers(transfers);
                                   const transferDetails = transfers
                                        .map((t, idx) => `${idx + 1}. ${t.amount} SUI to ${addressMap[t.to] || t.to}`)
                                        .join("\n");
                                   responseContent = `I detected a transfer request!\n\n${transferDetails}\n\nExecuting transaction...`;

                                   // Execute transfer after a short delay to ensure state is updated
                                   setTimeout(() => {
                                        if (account && suiClient && Object.keys(addressMap).length > 0) {
                                             console.log("Executing transfer from sendMessage (retry 2):", {
                                                  transfers,
                                                  addressMap,
                                                  account: account.address,
                                             });
                                             executeTransfer(transfers, addressMap);
                                        }
                                   }, 1000);
                              }

                              const assistantMessage: Message = {
                                   role: "assistant",
                                   content: responseContent,
                                   timestamp: new Date(),
                              };
                              setMessages((prev) => [...prev, assistantMessage]);
                         } catch (err3) {
                              lastError = err3;
                         }
                    }
               }

               if (!success) {
                    setError(`Failed to get response after multiple attempts. Please try again.`);
               }
          } catch (err) {
               setError("Connection error. Please check your internet connection and try again.");
          } finally {
               setIsLoading(false);
          }
     };

     const scrollToBottom = () => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
     };

     const executeTransfer = async (
          transfersToExecute?: Array<{ amount: number; to: string }>,
          addressMapToUse?: Record<string, string>,
     ) => {
          const transfers = transfersToExecute || pendingTransfers;
          const addressMap = addressMapToUse || currentAddressMap;

          // Prevent multiple simultaneous executions
          if (transferExecutionRef.current || isExecutingTransfer) {
               console.log("Transfer already executing, skipping:", {
                    transferExecutionRef: transferExecutionRef.current,
                    isExecutingTransfer,
               });
               return;
          }

          if (!transfers || !account || !suiClient) {
               console.log("Cannot execute transfer - missing requirements:", {
                    transfers: !!transfers,
                    account: !!account,
                    suiClient: !!suiClient,
               });
               return;
          }

          console.log("Executing transfer with:", {
               transfers,
               addressMap,
               account: account.address,
          });

          transferExecutionRef.current = true;
          setIsExecutingTransfer(true);
          try {
               const tx = new Transaction();

               // Prepare all transfers
               const validTransfers = transfers
                    .map((transfer) => {
                         const recipient = addressMap[transfer.to];
                         console.log(`Mapping transfer: ${transfer.to} -> ${recipient}`);
                         return {
                              amount: BigInt(Math.floor(transfer.amount * 1e9)), // Convert SUI to MIST
                              recipient,
                         };
                    })
                    .filter((t) => t.recipient); // Only include transfers with valid recipients

               if (validTransfers.length === 0) {
                    setMessages((prev) => [
                         ...prev,
                         {
                              role: "assistant",
                              content: "❌ No valid recipients found for transfer.",
                              timestamp: new Date(),
                         },
                    ]);
                    setPendingTransfers(null);
                    setIsExecutingTransfer(false);
                    transferExecutionRef.current = false;
                    return;
               }

               // Split coins for all transfers at once
               const amounts = validTransfers.map((t) => t.amount);
               const coins = tx.splitCoins(tx.gas, amounts);

               // Transfer each coin to its recipient
               validTransfers.forEach((transfer, index) => {
                    tx.transferObjects([coins[index]], transfer.recipient);
                    console.log(`Transferring ${transfer.amount} MIST to ${transfer.recipient}`);
               });

               console.log("Building transaction with", validTransfers.length, "transfers");

               signAndExecuteTransaction(
                    { transaction: tx as any },
                    {
                         onSuccess: (result) => {
                              console.log("Transfer successful:", result);
                              setMessages((prev) => [
                                   ...prev,
                                   {
                                        role: "assistant",
                                        content: `✅ Transfer completed successfully! Sent ${validTransfers.length} transaction(s).`,
                                        timestamp: new Date(),
                                   },
                              ]);
                              setPendingTransfers(null);
                              setCurrentAddressMap({});
                              setIsExecutingTransfer(false);
                              transferExecutionRef.current = false;
                         },
                         onError: (error) => {
                              console.error("Transfer failed:", error);
                              setMessages((prev) => [
                                   ...prev,
                                   {
                                        role: "assistant",
                                        content: `Transfer failed: ${
                                             error.message || "Unknown error"
                                        }. Please try again.`,
                                        timestamp: new Date(),
                                   },
                              ]);
                              setPendingTransfers(null);
                              setCurrentAddressMap({});
                              setIsExecutingTransfer(false);
                              transferExecutionRef.current = false;
                         },
                    },
               );
          } catch (error) {
               console.error("Error building transaction:", error);
               setMessages((prev) => [
                    ...prev,
                    {
                         role: "assistant",
                         content: "❌ Error building transaction. Please check the amounts and addresses.",
                         timestamp: new Date(),
                    },
               ]);
               setIsExecutingTransfer(false);
               transferExecutionRef.current = false;
          }
     };

     useEffect(() => {
          scrollToBottom();
     }, [messages]);

     useEffect(() => {
          if (isOpen && inputRef.current) {
               inputRef.current.focus();
          }
     }, [isOpen]);

     // Update mail data periodically when chat is open
     useEffect(() => {
          if (!isOpen) return;

          // Update immediately
          updateMailDataFromWindow();

          // Set up periodic updates every 2 seconds
          const interval = setInterval(() => {
               updateMailDataFromWindow();
          }, 2000);

          return () => clearInterval(interval);
     }, [isOpen]);

     if (!isOpen) {
          return (
               <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform duration-200 group"
                    title="Chat with AI Assistant"
               >
                    <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
               </button>
          );
     }

     return (
          <div className="fixed bottom-8 right-8 z-50 w-[325px] md:w-[450px] h-[650px] bg-white rounded-3xl shadow-2xl border-2 border-black flex flex-col">
               {/* Header */}
               <div className="flex items-center justify-between p-4 border-b border-black">
                    <div className="flex items-center gap-2">
                         <MessageCircle size={20} className="text-primary" />
                         <h3 className="font-bold text-black">Mail Assistant</h3>
                    </div>
                    <div className="flex items-center gap-2">
                         <button
                              onClick={() => setIsOpen(false)}
                              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                         >
                              <X size={18} className="text-gray-600" />
                         </button>
                    </div>
               </div>

               {/* Messages */}
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((message, index) => (
                         <div
                              key={index}
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                         >
                              <div
                                   className={`max-w-[90%] p-3 rounded-lg ${
                                        message.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-black"
                                   }`}
                              >
                                   <div className="prose prose-sm max-w-none text-sm break-words">
                                        <ReactMarkdown
                                             components={{
                                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                  ul: ({ children }) => (
                                                       <ul className="list-disc list-inside mb-2 space-y-1">
                                                            {children}
                                                       </ul>
                                                  ),
                                                  ol: ({ children }) => (
                                                       <ol className="list-decimal list-inside mb-2 space-y-1">
                                                            {children}
                                                       </ol>
                                                  ),
                                                  li: ({ children }) => <li className="break-words">{children}</li>,
                                                  code: (props) => {
                                                       return (
                                                            <code className="bg-black/10 px-1 py-0.5 rounded text-xs break-all">
                                                                 {props.children}
                                                            </code>
                                                       );
                                                  },
                                                  strong: ({ children }) => (
                                                       <strong className="font-bold break-words">{children}</strong>
                                                  ),
                                                  em: ({ children }) => (
                                                       <em className="italic break-words">{children}</em>
                                                  ),
                                                  h1: ({ children }) => (
                                                       <h1 className="text-sm font-bold break-words">{children}</h1>
                                                  ),
                                                  h2: ({ children }) => (
                                                       <h2 className="text-sm font-bold break-words">{children}</h2>
                                                  ),
                                                  h3: ({ children }) => (
                                                       <h3 className="text-sm font-bold break-words">{children}</h3>
                                                  ),
                                                  h4: ({ children }) => (
                                                       <h4 className="text-sm font-semibold break-words">{children}</h4>
                                                  ),
                                                  blockquote: ({ children }) => (
                                                       <blockquote className="border-l-4 border-black/20 pl-3 italic break-words">
                                                            {children}
                                                       </blockquote>
                                                  ),
                                             }}
                                        >
                                             {message.content}
                                        </ReactMarkdown>
                                   </div>
                                   <p className="text-xs mt-2">{message.timestamp.toLocaleTimeString()}</p>
                              </div>
                         </div>
                    ))}
                    {isLoading && (
                         <div className="flex justify-start">
                              <div className="bg-gray-100 text-black p-3 rounded-lg">
                                   <div className="flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span className="text-sm">Thinking...</span>
                                   </div>
                              </div>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
               </div>

               {/* Input */}
               <div className="p-4 border-t border-black">
                    <form
                         onSubmit={(e) => {
                              e.preventDefault();
                              sendMessage();
                         }}
                    >
                         <textarea
                              ref={inputRef}
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => {
                                   if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                   }
                              }}
                              placeholder="What’s on your mind?"
                              disabled={isLoading}
                              rows={2}
                              className="w-full px-4 py-3 text-sm bg-muted border-2 border-secondary rounded-xl focus:outline-none focus:border-secondary transition-colors disabled:bg-gray-200 resize-none"
                         />
                    </form>
               </div>
          </div>
     );
};

export default ChatBubble;
