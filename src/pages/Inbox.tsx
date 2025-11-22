import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Reply,
  FileText,
  Download,
  Loader2,
  Copy,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSuiNs } from "../hooks/useSuiNs";
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
  parentMailId?: string;
  recipients?: string[];
}

const Inbox = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializingSession, setInitializingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [parentMail, setParentMail] = useState<any>(null);
  const [loadingParent, setLoadingParent] = useState(false);
  const [recipientNames, setRecipientNames] = useState<
    Map<string, string | null>
  >(new Map());
  const [showAllRecipients, setShowAllRecipients] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const navigate = useNavigate();
  const { resolveAddresses, formatAddress } = useSuiNs();

  // Reset expanded state when selecting a new email
  useEffect(() => {
    setShowAllRecipients(false);
  }, [selectedEmail]);

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

  // Listen for manual refresh triggers from Compose page
  useEffect(() => {
    const checkForRefreshTrigger = () => {
      if ((window as any).forceInboxRefresh) {
        console.log("🔄 Refresh trigger detected, reloading emails...");
        loadEmails();
        // Clear the trigger
        (window as any).forceInboxRefresh = null;
      }
    };

    // Check immediately
    checkForRefreshTrigger();

    // Set up interval to check for refresh triggers
    const interval = setInterval(checkForRefreshTrigger, 1000);

    return () => clearInterval(interval);
  }, [currentAccount, sessionInitialized]);

  const initializeDecryptionSession = async () => {
    if (!currentAccount || sessionInitialized) return;

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

  const loadParentMail = async (parentMailId: string) => {
    console.log("🔍 LOADING PARENT MAIL:", parentMailId);
    setLoadingParent(true);
    try {
      // Get the mail object
      console.log("📡 Fetching parent mail object...");
      const mailObject = await suiMailService.getMailById(parentMailId);
      console.log("✅ Parent mail object received:", {
        objectId: mailObject.data?.objectId,
        subject: mailObject.data?.content?.fields?.subject,
        sender: mailObject.data?.content?.fields?.sender,
        timestamp: mailObject.data?.content?.fields?.timestamp,
        reply_count: mailObject.data?.content?.fields?.reply_count,
      });

      if (mailObject.data?.content && "fields" in mailObject.data.content) {
        const fields = mailObject.data.content.fields as any;

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
                "⚠️ Parent mail decryption failed, trying plain download:",
                decryptError
              );
              mailContent = await walrusService.downloadBlobAsJson(
                fields.blob_id
              );
            }
          } else {
            mailContent = await walrusService.downloadBlobAsJson(
              fields.blob_id
            );
          }

          // Format timestamp
          const mailTimestamp = mailContent.timestamp || fields.timestamp;
          const timestamp = new Date(
            typeof mailTimestamp === "string"
              ? mailTimestamp
              : parseInt(mailTimestamp)
          ).toLocaleString();

          const parentEmail = {
            id: mailObject.data.objectId,
            subject: fields.subject || mailContent.subject,
            preview: mailContent.body.replace(/<[^>]*>/g, "").substring(0, 100),
            body: mailContent.body,
            time: timestamp,
            blobId: fields.blob_id,
            attachments: mailContent.attachments,
            sender: fields.sender,
          };

          setParentMail(parentEmail);
        } catch (error) {
          console.warn("Failed to load parent mail content:", error);
          setParentMail(null);
        }
      }
    } catch (error) {
      console.error("Failed to load parent mail:", error);
      setParentMail(null);
    } finally {
      setLoadingParent(false);
    }
  };

  useEffect(() => {
    if (selectedEmail) {
      // Reset parent mail when selecting a new email
      setParentMail(null);

      // Load parent mail if this email has one
      if (selectedEmail.parentMailId) {
        console.log("🔗 SELECTED EMAIL HAS PARENT:", {
          selectedEmailId: selectedEmail.id,
          parentMailId: selectedEmail.parentMailId,
          subject: selectedEmail.subject,
        });
        loadParentMail(selectedEmail.parentMailId);
      } else {
        console.log("📧 SELECTED EMAIL (no parent):", {
          selectedEmailId: selectedEmail.id,
          subject: selectedEmail.subject,
        });
      }
    }
  }, [selectedEmail]);

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
    console.log("📥 LOADING INBOX MAILS for:", currentAccount.address);
    try {
      const mailObjects = await suiMailService.getReceivedMails(
        currentAccount.address
      );

      console.log("📬 Total received mail objects found:", mailObjects.length);

      // Log all received mail object IDs
      mailObjects.forEach((mailObj, index) => {
        const mailId = mailObj.data?.objectId;
        console.log(`📥 Received Mail ${index + 1}:`, {
          objectId: mailId,
          subject: mailObj.data?.content?.fields?.subject,
          timestamp: mailObj.data?.content?.fields?.timestamp,
          blobId: mailObj.data?.content?.fields?.blob_id,
        });
      });

      // Get mail threading relationships
      const mailThreading = await suiMailService.getMailThreadingForUser(
        currentAccount.address
      );

      console.log("🔗 Mail threading relationships found:", mailThreading.size);

      // Log all threading relationships
      mailThreading.forEach((parentMailId, replyMailId) => {
        console.log(`🔗 Threading: Reply ${replyMailId} -> Parent ${parentMailId}`);
      });

      // Specifically check for the reply we know about
      const targetReplyId = "0x43c6d3f04f2ee2563b8c4e0883b926c0e4e05530039297f9f376a5fbf840b9fb";
      const targetReplyFound = mailObjects.some(mail => mail.data?.objectId === targetReplyId);
      const targetReplyParent = mailThreading.get(targetReplyId);

      console.log(`🎯 TARGET REPLY ANALYSIS for ${targetReplyId}:`);
      console.log(`   Found in received mails: ${targetReplyFound}`);
      console.log(`   Parent mail ID: ${targetReplyParent || 'NOT FOUND'}`);
      console.log(`   Threading working: ${targetReplyFound && targetReplyParent ? 'YES' : 'NO'}`);

      // Also check for 0xc2fd95 (the reply you clicked)
      const clickedReplyId = "0xc2fd95b4635e017f91c0042b1a55299fc486b8324346cf9dec2ac12063615329";
      const clickedReplyFound = mailObjects.some(mail => mail.data?.objectId === clickedReplyId);
      const clickedReplyParent = mailThreading.get(clickedReplyId);

      console.log(`🎯 CLICKED REPLY ANALYSIS for ${clickedReplyId}:`);
      console.log(`   Found in received mails: ${clickedReplyFound}`);
      console.log(`   Parent mail ID: ${clickedReplyParent || 'NOT FOUND'}`);
      console.log(`   Parent matches target: ${clickedReplyParent === targetReplyId ? 'YES' : 'NO'}`);
      console.log(`   Threading working: ${clickedReplyFound && clickedReplyParent ? 'YES' : 'NO'}`);

      // Check for any new replies after our last test
      console.log(`📋 ALL REPLY THREADING RELATIONSHIPS:`);
      mailThreading.forEach((parentMailId, replyMailId) => {
        if (replyMailId.includes('0xc2fd95') || parentMailId.includes('0x43c6d3f')) {
          console.log(`   Related: Reply ${replyMailId} -> Parent ${parentMailId}`);
        }
      });

      const parsedEmails: Email[] = [];

      for (const mailObj of mailObjects) {
        if (mailObj.data?.content && "fields" in mailObj.data.content) {
          const fields = mailObj.data.content.fields as any;
          const mailId = mailObj.data.objectId;

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

            // Check if this mail is a reply to another mail
            const parentMailId = mailThreading.get(mailId);

            parsedEmails.push({
              id: mailId,
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
              parentMailId,
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

            // Check if this expired mail is a reply to another mail
            const parentMailId = mailThreading.get(mailId);

            parsedEmails.push({
              id: mailId,
              sender: fields.sender,
              subject: fields.subject || "[Encrypted Mail]",
              preview: "Encrypted mail content",
              body: "<p>🔒 This mail is encrypted. Please initialize decryption to view the content.</p>",
              time: fallbackTimestamp,
              unread: false,
              attachments: [],
              blobId: fields.blob_id,
              parentMailId,
            });
          }
        }
      }

      setEmails(parsedEmails);

      // Store inbox mails globally for AI assistant
      if (typeof window !== 'undefined') {
        (window as any).inboxMails = parsedEmails;
      }
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedEmail) {
    return (
      <div className="p-8 h-full flex flex-col relative">
        <div className="flex flex-col gap-4 mb-4">
          {/* Title Row */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedEmail(null)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-black" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <img
                src={`https://api.dicebear.com/9.x/glass/svg?seed=${selectedEmail.sender}`}
                alt="avatar"
                className="w-12 h-12 rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-black truncate">
                  {selectedEmail.subject}
                </h2>
                <div className="text-sm text-black flex items-center gap-2">
                  <span>
                    From: {selectedEmail.sender.slice(0, 6)}...
                    {selectedEmail.sender.slice(-4)}
                  </span>
                  {selectedEmail.recipients &&
                    selectedEmail.recipients.length > 0 && (
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

          {/* Parent Mail Display */}
          {loadingParent && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">
                Loading parent mail...
              </span>
            </div>
          )}

          {parentMail && !loadingParent && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
                  <Reply size={16} className="mr-2 text-blue-500" />
                  Replied to: {parentMail.subject}
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {/* Parent mail header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-black text-sm font-bold">
                        {parentMail.sender
                          ? parentMail.sender[0]?.toUpperCase()
                          : "P"}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">
                          {parentMail.sender
                            ? `${parentMail.sender.slice(
                                0,
                                6
                              )}...${parentMail.sender.slice(-4)}`
                            : "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {parentMail.time}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parent mail content */}
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <div className="ql-snow">
                      <div
                        className="ql-editor p-0 text-gray-700 leading-relaxed text-sm"
                        dangerouslySetInnerHTML={{ __html: parentMail.body }}
                      />
                    </div>
                  </div>

                  {/* Parent mail attachments */}
                  {parentMail.attachments &&
                    parentMail.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-600 mb-2">
                          Attachments ({parentMail.attachments.length})
                        </div>
                        <div className="space-y-1">
                          {parentMail.attachments.map(
                            (attachment: AttachmentInfo, index: number) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200"
                              >
                                <FileText size={14} className="text-gray-500" />
                                <span className="text-xs text-gray-700 truncate">
                                  {attachment.name}
                                </span>
                                <span className="text-xs text-gray-500 ml-auto">
                                  {formatFileSize(attachment.size)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
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

      {emails.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No messages in your inbox yet.
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => {
              setSelectedEmail(email);
              // Make selected email available to chat assistant
              (window as any).selectedEmail = email;
            }}
              className={`p-4 rounded-2xl border border-gray hover:bg-muted cursor-pointer transition-colors group ${
                email.unread ? "bg-muted/85" : "bg-gray"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-black font-semibold">{email.subject}</h3>
                <span className="text-xs text-black">{email.time}</span>
              </div>
              <h4
                className={`text-sm mb-1 ${
                  email.unread ? "text-gray-800 font-medium" : "text-gray-600"
                }`}
              >
                From: {email.sender.slice(0, 6)}...{email.sender.slice(-4)}
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
