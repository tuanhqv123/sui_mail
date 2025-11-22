import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Download,
  Copy,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "react-quill/dist/quill.snow.css";
import {
  useCurrentAccount,
  useSuiClient,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { MailDecryptionService } from "../services/mailDecryptionService";
import { type MailContent } from "../utils/encryption";
import { useSuiNs } from "../hooks/useSuiNs";

interface SentMail {
  id: string;
  subject: string;
  time: string;
  blobId: string;
  body?: string;
  attachments?: any[];
  recipients?: string[];
  allowlistId?: string;
  isDecrypted?: boolean;
  isEncrypted?: boolean;
}

const Sent = () => {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [sentMails, setSentMails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializingSession, setInitializingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [recipientNames, setRecipientNames] = useState<
    Map<string, string | null>
  >(new Map());
  const [showAllRecipients, setShowAllRecipients] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  // Memoize service instances to prevent recreation on every render
  const suiMailService = useMemo(
    () => new SuiMailService(suiClient),
    [suiClient]
  );
  const walrusService = useMemo(() => new WalrusService(), []);
  const decryptionService = useMemo(
    () => MailDecryptionService.getInstance(suiClient),
    [suiClient]
  );
  const { resolveAddresses, formatAddress } = useSuiNs();

  // Reset expanded state when selecting a new email
  useEffect(() => {
    setShowAllRecipients(false);
  }, [selectedEmail]);

  useEffect(() => {
    if (currentAccount) {
      // Auto-initialize decryption session first, then load mails
      if (!sessionInitialized) {
        initializeDecryptionSession();
      }
    }
  }, [currentAccount]);

  useEffect(() => {
    if (sessionInitialized && currentAccount) {
      loadSentMails();
    }
  }, [sessionInitialized]);

  const initializeDecryptionSession = async () => {
    if (!currentAccount || sessionInitialized || initializingSession) return;

    setInitializingSession(true);
    try {
      await decryptionService.initializeSessionKey(
        currentAccount.address,
        async ({ message }: { message: Uint8Array }) => {
          const result = await signPersonalMessage({ message });
          return { signature: result.signature };
        }
      );
      setSessionInitialized(true);
      console.log("✅ Session initialized successfully in Sent");
    } catch (error) {
      console.error("Failed to initialize decryption:", error);
      alert("Failed to initialize decryption session. Please try again.");
    } finally {
      setInitializingSession(false);
    }
  };

  // Decrypt mail content when user clicks on it
  const decryptAndLoadMail = async (email: SentMail): Promise<SentMail> => {
    if (email.isDecrypted) {
      return email;
    }

    console.log("🔓 Decrypting sent mail on demand:", email.id);

    try {
      let mailContent;

      if (email.isEncrypted && email.allowlistId && sessionInitialized) {
        try {
          mailContent = await decryptionService.decryptMail(
            email.blobId,
            email.allowlistId
          );
          console.log("✅ Sent mail decrypted successfully");
        } catch (decryptError) {
          console.warn("⚠️ Decryption failed, trying plain download:", decryptError);
          mailContent = await walrusService.downloadBlobAsJson(email.blobId);
        }
      } else {
        mailContent = await walrusService.downloadBlobAsJson(email.blobId);
      }

      const updatedEmail: SentMail = {
        ...email,
        subject: mailContent.subject || email.subject,
        body: mailContent.body || "",
        attachments: mailContent.attachments || [],
        isDecrypted: true,
      };

      setSentMails(prevMails => 
        prevMails.map(m => m.id === email.id ? updatedEmail : m)
      );

      return updatedEmail;
    } catch (error) {
      console.error("Failed to decrypt sent mail:", error);
      alert("Failed to load mail content. The blob may have expired.");
      return email;
    }
  };

  const downloadAttachment = async (attachment: any) => {
    try {
      const data = await walrusService.downloadBlob(attachment.blobId);
      const blob = new Blob([data as BlobPart], { type: attachment.type });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Failed to download attachment. Please try again.");
    }
  };

  const loadSentMails = async () => {
    if (!currentAccount) return;

    setLoading(true);
    console.log("📤 LOADING SENT MAILS for:", currentAccount.address);
    try {
      const mailObjects = await suiMailService.getSentMails(
        currentAccount.address
      );

      console.log("📬 Total sent mail objects found:", mailObjects.length);

      // Log all sent mail object IDs
      mailObjects.forEach((mailObj, index) => {
        console.log(`📤 Sent Mail ${index + 1}:`, {
          objectId: mailObj.data?.objectId,
          subject: mailObj.data?.content?.fields?.subject,
          timestamp: mailObj.data?.content?.fields?.timestamp,
          blobId: mailObj.data?.content?.fields?.blob_id,
        });
      });

      const parsedMails: SentMail[] = [];

      for (const mailObj of mailObjects) {
        if (mailObj.data?.content && "fields" in mailObj.data.content) {
          const fields = mailObj.data.content.fields as any;

          try {
            // DON'T decrypt on initial load - just store metadata
            const isEncrypted = !!fields.allowlist_id;

            // Format timestamp from blockchain
            let timestamp = "";
            try {
              const timestampNum = parseInt(fields.timestamp);
              if (!isNaN(timestampNum) && timestampNum > 0) {
                timestamp = new Date(timestampNum).toLocaleString();
              } else {
                timestamp = new Date().toLocaleString();
              }
            } catch (error) {
              timestamp = new Date().toLocaleString();
            }

            parsedMails.push({
              id: mailObj.data.objectId,
              subject: fields.subject || "Encrypted Mail",
              time: timestamp,
              blobId: fields.blob_id,
              body: "",
              attachments: [],
              recipients: [],
              allowlistId: fields.allowlist_id || undefined,
              isDecrypted: false,
              isEncrypted,
            });
          } catch (error) {
            // Skip mails with expired/corrupted Walrus blobs
            console.warn(
              `⚠️ Skipping mail ${mailObj.data.objectId} - blob expired or corrupted:`,
              error instanceof Error ? error.message : error
            );
            // Show placeholder for expired mail
            let fallbackTimestamp = "";
            try {
              const timestampNum = parseInt(fields.timestamp);
              if (!isNaN(timestampNum) && timestampNum > 0) {
                fallbackTimestamp = new Date(timestampNum).toLocaleString();
              } else {
                fallbackTimestamp = new Date().toLocaleString();
              }
            } catch (error) {
              fallbackTimestamp = new Date().toLocaleString();
            }

            parsedMails.push({
              id: mailObj.data.objectId,
              subject: fields.subject || "[Encrypted Mail]",
              preview: "Encrypted mail content",
              time: fallbackTimestamp,
              blobId: fields.blob_id,
              body: "<p>🔒 This mail is encrypted. Please initialize decryption to view the content.</p>",
              attachments: [],
            });
          }
        }
      }

      setSentMails(parsedMails);

      // Store sent mails globally for AI assistant
      if (typeof window !== 'undefined') {
        (window as any).sentMails = parsedMails;
      }

      // Resolve recipient names for all mails
      const allRecipients = new Set<string>();
      parsedMails.forEach((mail) => {
        if (mail.recipients) {
          mail.recipients.forEach((recipient) => allRecipients.add(recipient));
        }
      });

      if (allRecipients.size > 0) {
        const names = await resolveAddresses(Array.from(allRecipients));
        setRecipientNames(names);
      }
    } catch (error) {
      console.error("Failed to load sent mails:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (selectedEmail) {
    return (
      <div className="p-8 h-full flex flex-col relative">
        <div className="flex flex-col gap-2 mb-2">
          {/* Title Row - All on same line */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedEmail(null)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-black" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <img
                src="https://api.dicebear.com/9.x/glass/svg?seed=Jude"
                alt="avatar"
                className="w-12 h-12 rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-black truncate">
                  {selectedEmail.subject}
                </h3>
                <div className="text-sm text-black flex items-center gap-2">
                  <span>
                    From:{" "}
                    {currentAccount
                      ? `${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}`
                      : "Unknown"}
                  </span>
                  {selectedEmail.recipients && selectedEmail.recipients.length > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span>Recipients:</span>
                        <div className="flex flex-wrap gap-1">
                          {(showAllRecipients
                            ? selectedEmail.recipients
                            : selectedEmail.recipients.slice(0, 3)
                          ).map((recipient: string, index: number) => {
                            const suinsName = recipientNames.get(recipient);
                            return (
                              <span
                                key={index}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors flex-shrink-0"
                                title={`${
                                  suinsName ? suinsName + " - " : ""
                                }${recipient}`}
                                onClick={() => {
                                  navigator.clipboard.writeText(recipient);
                                  // Optional: Show toast notification
                                }}
                              >
                                {formatAddress(recipient, suinsName)}
                                <Copy
                                  size={10}
                                  className="opacity-50 hover:opacity-100 transition-opacity"
                                />
                              </span>
                            );
                          })}
                          {selectedEmail.recipients.length > 3 &&
                            !showAllRecipients && (
                              <span className="text-xs text-gray-500">
                                +{selectedEmail.recipients.length - 3} more
                              </span>
                            )}
                        </div>
                        {selectedEmail.recipients.length > 3 && (
                          <button
                            onClick={() =>
                              setShowAllRecipients(!showAllRecipients)
                            }
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded flex-shrink-0"
                          >
                            {showAllRecipients ? (
                              <>
                                <ChevronUp size={14} />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown size={14} />
                                Show All
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>{selectedEmail.time}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Mail content */}
          <div className="bg-white border border-gray-200 rounded mb-4">
            <div className="ql-snow">
              <div
                className="ql-editor p-0 text-black leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: selectedEmail.body,
                }}
              />
            </div>
          </div>

          {/* Attachments */}
          {selectedEmail.attachments &&
            selectedEmail.attachments.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-black/60 mb-3">
                  Attachments ({selectedEmail.attachments.length})
                </h3>
                <div className="space-y-2">
                  {selectedEmail.attachments.map(
                    (attachment: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-xl border border-black/10 bg-white/50 w-fit"
                      >
                        <div className="p-2 bg-secondary/30 rounded-lg">
                          <FileText size={24} className="text-black" />
                        </div>
                        <div>
                          <p className="font-medium text-black text-sm">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-black/50">
                            {attachment.size} bytes
                          </p>
                        </div>
                        <button
                          onClick={() => downloadAttachment(attachment)}
                          className="ml-4 p-2 hover:bg-black/5 rounded-lg transition-colors"
                        >
                          <Download size={20} className="text-black/70" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-gray-800">Sent</h1>
        <div className="flex items-center gap-4">
          {initializingSession && (
            <span className="text-sm text-blue-600 font-medium">
              Initializing decryption...
            </span>
          )}
          {sessionInitialized && (
            <span className="text-sm text-green-600 font-medium">
              Decryption Active
            </span>
          )}
        </div>
      </header>

      {sentMails.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No sent messages yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sentMails.map((mail) => (
            <div
              key={mail.id}
              onClick={async () => {
              // Decrypt mail on demand before showing
              const decryptedMail = await decryptAndLoadMail(mail);
              setSelectedEmail(decryptedMail);
              // Make selected email available to chat assistant
              (window as any).selectedEmail = decryptedMail;
            }}
              className="p-4 rounded-2xl border border-gray hover:bg-muted cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-black font-semibold text-base">
                  {mail.subject}
                </h3>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>{mail.time}</span>
                </div>
              </div>

              {mail.recipients && mail.recipients.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex flex-wrap text-sm gap-1">
                    To:{" "}
                    {mail.recipients
                      .slice(0, 3)
                      .map((recipient: string, index: number) => {
                        const suinsName = recipientNames.get(recipient);
                        return (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-700 hover:bg-gray-200 cursor-pointer"
                          >
                            {formatAddress(recipient, suinsName)}
                            <Copy
                              size={10}
                              className="opacity-50 hover:opacity-100"
                            />
                          </span>
                        );
                      })}
                    {mail.recipients.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{mail.recipients.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-500 line-clamp-2">
                {mail.preview}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Sent;
