import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Download,
  Copy,
  Users,
  Clock,
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
  preview: string;
  time: string;
  blobId: string;
  body?: string;
  attachments?: any[];
  recipients?: string[];
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
    () => new MailDecryptionService(suiClient),
    [suiClient]
  );
  const { resolveAddresses, formatAddress } = useSuiNs();

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
        async (message: Uint8Array) => {
          const result = await signPersonalMessage({ message });
          return { signature: result.signature };
        }
      );
      setSessionInitialized(true);
    } catch (error) {
      console.error("Failed to initialize decryption:", error);
      alert("Failed to initialize decryption session. Please try again.");
    } finally {
      setInitializingSession(false);
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
    try {
      const mailObjects = await suiMailService.getSentMails(
        currentAccount.address
      );

      const parsedMails: SentMail[] = [];

      for (const mailObj of mailObjects) {
        if (mailObj.data?.content && "fields" in mailObj.data.content) {
          const fields = mailObj.data.content.fields as any;

          try {
            let mailContent: MailContent;

            // Try to decrypt mail if session is initialized
            if (sessionInitialized && fields.allowlist_id) {
              try {
                mailContent = await decryptionService.decryptMail(
                  fields.blob_id,
                  fields.allowlist_id
                );
              } catch (decryptError) {
                console.warn(
                  "⚠️ Decryption failed, trying plain download:",
                  decryptError
                );
                // Fallback to plain download if decryption fails
                mailContent = await walrusService.downloadBlobAsJson(
                  fields.blob_id
                );
              }
            } else {
              // No session or no allowlist - try plain download
              mailContent = await walrusService.downloadBlobAsJson(
                fields.blob_id
              );
            }

            // Format timestamp - use mailContent timestamp (when mail was created) over blockchain timestamp
            let timestamp = "";
            try {
              // Prefer the timestamp from the mail content (when it was composed)
              if (mailContent.timestamp) {
                timestamp = new Date(mailContent.timestamp).toLocaleString();
              } else {
                // Fallback to blockchain timestamp
                const timestampNum = parseInt(fields.timestamp);
                if (!isNaN(timestampNum) && timestampNum > 0) {
                  timestamp = new Date(timestampNum).toLocaleString();
                } else {
                  timestamp = new Date().toLocaleString();
                }
              }
            } catch (error) {
              console.warn("Invalid timestamp:", {
                mailTimestamp: mailContent.timestamp,
                blockchainTimestamp: fields.timestamp,
              });
              timestamp = new Date().toLocaleString();
            }

            parsedMails.push({
              id: mailObj.data.objectId,
              subject: fields.subject || mailContent.subject,
              preview: mailContent.body
                .replace(/<[^>]*>/g, "")
                .substring(0, 100),
              time: timestamp,
              blobId: fields.blob_id,
              body: mailContent.body,
              attachments: mailContent.attachments,
              recipients: mailContent.recipients || [],
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedEmail(null)}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-black" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-black font-bold">
              YOU
            </div>
            <div>
              <h3 className="text-normal font-bold text-black">
                {selectedEmail.subject}
              </h3>
              <div className="text-sm text-gray-600">
                From:{" "}
                {currentAccount
                  ? `${currentAccount.address.slice(
                      0,
                      6
                    )}...${currentAccount.address.slice(-4)}`
                  : "Unknown"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 ml-auto">
            <span>{selectedEmail.time}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mb-2 pb-2 border-b border-gray-200">
            {selectedEmail.recipients &&
              selectedEmail.recipients.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">
                    Recipients:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.recipients.map(
                      (recipient: string, index: number) => {
                        const suinsName = recipientNames.get(recipient);
                        return (
                          <div
                            key={index}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <span className="text-sm text-gray-700 font-medium">
                              {suinsName ? (
                                <>
                                  <span className="text-blue-600">
                                    {suinsName}
                                  </span>
                                  <span className="text-gray-500">
                                    ({recipient.slice(0, 6)}
                                    ...
                                    {recipient.slice(-4)})
                                  </span>
                                </>
                              ) : (
                                `${recipient.slice(0, 6)}...${recipient.slice(
                                  -4
                                )}`
                              )}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
          </div>

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
              🔐 Initializing decryption...
            </span>
          )}
          {sessionInitialized && (
            <span className="text-sm text-green-600 font-medium">
              🔓 Decryption Active
            </span>
          )}
          <div className="text-sm text-gray-500">
            {sentMails.length} messages
          </div>
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
              onClick={() => setSelectedEmail(mail)}
              className="p-4 rounded-2xl border border-gray hover:bg-muted cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-black font-semibold text-sm">
                  {mail.subject}
                </h3>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>{mail.time}</span>
                </div>
              </div>

              {mail.recipients && mail.recipients.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-gray-400" />
                  <div className="flex flex-wrap gap-1">
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
