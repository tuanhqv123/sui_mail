import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AI_CONFIG, makeAIChatRequest } from "../config/ai";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentApiKeyIndex, setCurrentApiKeyIndex] = useState(0);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mail data storage for AI context
  const mailDataStorage = useRef<{
    inbox: any[];
    sent: any[];
    currentMail: any;
    lastUpdated: number;
  }>({
    inbox: [],
    sent: [],
    currentMail: null,
    lastUpdated: 0,
  });

  // Update mail data from window object
  const updateMailDataFromWindow = () => {
    if (typeof window !== "undefined") {
      const currentEmail = (window as any).selectedEmail;
      const inboxMails = (window as any).inboxMails || [];
      const sentMails = (window as any).sentMails || [];

      // Only update if there's new data
      if (
        currentEmail !== mailDataStorage.current.currentMail ||
        JSON.stringify(inboxMails) !==
          JSON.stringify(mailDataStorage.current.inbox) ||
        JSON.stringify(sentMails) !==
          JSON.stringify(mailDataStorage.current.sent)
      ) {
        mailDataStorage.current = {
          inbox: inboxMails,
          sent: sentMails,
          currentMail: currentEmail,
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

  const generateMailAssistPrompt = () => {
    const mailData = mailDataStorage.current;

    let contextInfo = "";

    // Current email context
    if (mailData.currentMail) {
      contextInfo += `\n## Currently Selected Email:\n`;
      contextInfo += `- Subject: ${
        mailData.currentMail.subject || "No subject"
      }\n`;
      contextInfo += `- From: ${
        mailData.currentMail.sender || "Unknown sender"
      }\n`;
      contextInfo += `- To: ${
        mailData.currentMail.recipients?.join(", ") || "No recipients"
      }\n`;
      contextInfo += `- Date: ${mailData.currentMail.time || "Unknown date"}\n`;
      if (mailData.currentMail.body) {
        contextInfo += `- Content: ${mailData.currentMail.body
          .replace(/<[^>]*>/g, "")
          .substring(0, 800)}${
          mailData.currentMail.body.length > 800 ? "..." : ""
        }\n`;
      }
      contextInfo += `- Attachments: ${
        mailData.currentMail.attachments?.length || 0
      } files\n`;
    }

    // Recent emails summary
    const recentInbox = mailData.inbox.slice(0, 3);
    const recentSent = mailData.sent.slice(0, 3);

    if (recentInbox.length > 0) {
      contextInfo += `\n## Recent Received Emails (last 3):\n`;
      recentInbox.forEach((mail, index) => {
        contextInfo += `${index + 1}. ${mail.subject || "No subject"} - From: ${
          mail.sender || "Unknown"
        } - ${mail.time || "No date"}\n`;
      });
    }

    if (recentSent.length > 0) {
      contextInfo += `\n## Recent Sent Emails (last 3):\n`;
      recentSent.forEach((mail, index) => {
        contextInfo += `${index + 1}. ${mail.subject || "No subject"} - To: ${
          mail.recipients?.join(", ") || "No recipients"
        } - ${mail.time || "No date"}\n`;
      });
    }

    return `You are an AI assistant for Sui Mail, a decentralized email application on Sui blockchain. Help the user with their mail-related questions.${contextInfo}

## Your Capabilities:
- Analyze and summarize emails
- Help draft replies and new emails
- Search through mail history for specific information
- Suggest improvements to email content
- Provide email etiquette advice
- Explain encryption and blockchain features
- Help organize and manage emails

## Instructions:
- Use the provided mail context to give personalized assistance
- When asked about specific emails, reference the content from the context
- If you need more information about an email, ask the user to select it
- Be concise but thorough in your responses
- Format your responses with clear structure using markdown

Current time: ${new Date().toLocaleString()}`;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Update mail data from window before generating prompt
      updateMailDataFromWindow();

      const systemPrompt = generateMailAssistPrompt();

      const messagesForAPI = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10), // Keep last 10 messages for context
        userMessage,
      ];

      let success = false;
      let lastError: any = null;
      let apiKeyIndex = currentApiKeyIndex;
      let modelIndex = currentModelIndex;

      // Try with current configuration first
      try {
        const response = await makeAIChatRequest(messagesForAPI, apiKeyIndex, modelIndex);
        success = true;
        
        const assistantMessage: Message = {
          role: "assistant",
          content: response.choices[0]?.message?.content || "No response",
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
          
          const assistantMessage: Message = {
            role: "assistant",
            content: response.choices[0]?.message?.content || "No response",
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
            
            const assistantMessage: Message = {
              role: "assistant",
              content: response.choices[0]?.message?.content || "No response",
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
      setError(
        "Connection error. Please check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        className="fixed bottom-8 right-8 z-50 bg-primary text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform duration-200 group"
        title="Chat with AI Assistant"
      >
        <MessageCircle
          size={24}
          className="group-hover:scale-110 transition-transform"
        />
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 w-[450px] h-[650px] bg-white rounded-3xl shadow-2xl border-2 border-black flex flex-col">
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
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-black"
              }`}
            >
              <div className="prose prose-sm max-w-none text-sm break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
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
                    li: ({ children }) => (
                      <li className="break-words">{children}</li>
                    ),
                    code: (props) => {
                      return (
                        <code className="bg-black/10 px-1 py-0.5 rounded text-xs break-all">
                          {props.children}
                        </code>
                      );
                    },
                    strong: ({ children }) => (
                      <strong className="font-bold break-words">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic break-words">{children}</em>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mb-2 break-words">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mb-2 break-words">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mb-1 break-words">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-sm font-semibold mb-1 break-words">
                        {children}
                      </h4>
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
              <p className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            <p className="font-medium">Error: {error}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={switchToNextModel}
                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition-colors"
              >
                Switch Model
              </button>
              <button
                onClick={switchToNextApiKey}
                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition-colors"
              >
                Switch API Key
              </button>
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
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your email... (Press Enter to send)"
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm bg-muted border-2 border-secondary rounded-full focus:outline-none focus:border-secondary transition-colors disabled:bg-gray-200"
          />
        </form>
        {isLoading && (
          <div className="mt-2 text-center text-sm text-gray-500">
            AI is thinking...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
