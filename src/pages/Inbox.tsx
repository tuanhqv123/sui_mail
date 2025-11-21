import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Reply, FileText, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "react-quill/dist/quill.snow.css";
import Button from "../components/Button";
import {
  useCurrentAccount,
  useSuiClient,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { MailDecryptionService } from "../services/mailDecryptionService";
import {
  formatFileSize,
  type MailContent,
  type AttachmentInfo,
} from "../utils/encryption";

interface Email {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  attachments?: AttachmentInfo[];
  blobId: string;
}

const Inbox = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializingSession, setInitializingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (currentAccount) {
      // Auto-initialize decryption session first, then load emails
      if (!sessionInitialized) {
        initializeDecryptionSession();
      }
    }
  }, [currentAccount]);

  useEffect(() => {
    if (sessionInitialized && currentAccount) {
      loadEmails();
    }
  }, [sessionInitialized]);

  const initializeDecryptionSession = async () => {
    if (!currentAccount || sessionInitialized) return;

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
      console.error("Failed to initialize decryption session:", error);
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

  const handleReply = () => {
    if (selectedEmail) {
      navigate("/compose", {
        state: {
          replyTo: selectedEmail.sender,
          replySubject: selectedEmail.subject.startsWith("Re: ")
            ? selectedEmail.subject
            : `Re: ${selectedEmail.subject}`,
          parentMailId: selectedEmail.id,
        },
      });
    }
  };

  const loadEmails = async () => {
    if (!currentAccount) return;

    setLoading(true);
    try {
      const mailObjects = await suiMailService.getReceivedMails(
        currentAccount.address
      );

      const parsedEmails: Email[] = [];

      for (const mailObj of mailObjects) {
        if (mailObj.data?.content && "fields" in mailObj.data.content) {
          const fields = mailObj.data.content.fields as any;

          try {
            let mailContent: MailContent;

            console.log("📧 Processing mail:", {
              blobId: fields.blob_id,
              sessionInitialized,
              hasAllowlist: !!fields.allowlist_id,
              allowlistId: fields.allowlist_id,
            });

            // Try to decrypt mail if session is initialized
            if (sessionInitialized && fields.allowlist_id) {
              try {
                console.log("🔓 Attempting decryption for:", fields.blob_id);
                mailContent = await decryptionService.decryptMail(
                  fields.blob_id,
                  fields.allowlist_id
                );
                console.log("✅ Mail decrypted successfully:", fields.blob_id);
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

            // Format timestamp - mailContent.timestamp is ISO string from encryption
            const mailTimestamp = mailContent.timestamp || fields.timestamp;
            const timestamp = new Date(
              typeof mailTimestamp === "string"
                ? mailTimestamp
                : parseInt(mailTimestamp)
            ).toLocaleString();

            parsedEmails.push({
              id: mailObj.data.objectId,
              sender: fields.sender,
              subject: fields.subject || mailContent.subject,
              preview: mailContent.body
                .replace(/<[^>]*>/g, "")
                .substring(0, 100),
              body: mailContent.body,
              time: timestamp,
              unread: false,
              attachments: mailContent.attachments,
              blobId: fields.blob_id,
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

            parsedEmails.push({
              id: mailObj.data.objectId,
              sender: fields.sender,
              subject: fields.subject || "[Encrypted Mail]",
              preview: "Encrypted mail content",
              body: "<p>🔒 This mail is encrypted. Please initialize decryption to view the content.</p>",
              time: fallbackTimestamp,
              unread: false,
              attachments: [],
              blobId: fields.blob_id,
            });
          }
        }
      }

      setEmails(parsedEmails);
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedEmail) {
    return (
      <div className="p-8 h-full flex flex-col relative">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedEmail(null)}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-black" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-black font-bold">
              {selectedEmail.sender[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-black">
                {selectedEmail.subject}
              </h2>
              <div className="text-sm text-gray-600">
                From: {selectedEmail.sender.slice(0, 6)}...
                {selectedEmail.sender.slice(-4)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 ml-auto">
            <span>{selectedEmail.time}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="bg-white border border-gray-200 rounded mb-4">
            <div className="ql-snow">
              <div
                className="ql-editor p-0 text-black leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          </div>

          {selectedEmail.attachments &&
            selectedEmail.attachments.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-black/60 mb-3">
                  Attachments ({selectedEmail.attachments.length})
                </h3>
                <div className="space-y-2">
                  {selectedEmail.attachments.map(
                    (attachment: AttachmentInfo, index: number) => (
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
                            {formatFileSize(attachment.size)}
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

        <div className="absolute bottom-8 right-8">
          <Button variant="outline" onClick={handleReply}>
            <Reply size={20} />
            <span className="font-medium">Reply</span>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-gray-800">Inbox</h1>
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
          <div className="text-sm text-gray-500">{emails.length} messages</div>
        </div>
      </header>

      {emails.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No messages in your inbox yet.
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className={`p-4 rounded-2xl border border-gray hover:bg-muted cursor-pointer transition-colors group ${
                email.unread ? "bg-muted/85" : "bg-gray"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-black font-semibold">
                  {email.sender.slice(0, 6)}...{email.sender.slice(-4)}
                </h3>
                <span className="text-xs text-black">{email.time}</span>
              </div>
              <h4
                className={`text-sm mb-1 ${
                  email.unread ? "text-gray-800 font-medium" : "text-gray-600"
                }`}
              >
                {email.subject}
              </h4>
              <p className="text-sm text-gray-500 line-clamp-1">
                {email.preview}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inbox;
