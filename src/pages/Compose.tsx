import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import Button from "../components/Button";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getFullnodeUrl } from "@mysten/sui/client";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { SealEncryptionService } from "../services/sealService";
import { SuiNsService } from "../services/suiNsService";
import { PACKAGE_ID } from "../config/constants";
import {
  combineMailContent,
  stringifyMailContent,
  validateFile,
  formatFileSize,
  stringToUint8Array,
  uint8ArrayToBase64,
  type AttachmentInfo,
  type EncryptedMailContent,
} from "../utils/encryption";
import ErrorModal from "../components/ErrorModal";

interface LocationState {
  replyTo?: string;
  replySubject?: string;
  parentMailId?: string;
}

const Compose = () => {
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientNames, setRecipientNames] = useState<
    Map<string, string | null>
  >(new Map());
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [parentMailId, setParentMailId] = useState<string | undefined>(
    undefined
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [checkingBlocklist, setCheckingBlocklist] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Handle reply prefill
  useEffect(() => {
    if (locationState?.replyTo) {
      setRecipients([locationState.replyTo]);
    }
    if (locationState?.replySubject) {
      setSubject(locationState.replySubject);
    }
    if (locationState?.parentMailId) {
      setParentMailId(locationState.parentMailId);
    }
  }, [locationState]);

  // Resolve recipient names when recipients change
  useEffect(() => {
    if (recipients.length > 0) {
      const resolveNames = async () => {
        const names = new Map<string, string | null>();

        await Promise.all(
          recipients.map(async (address) => {
            try {
              const name = await suiNsService.resolveAddressToName(address);
              names.set(address, name);
            } catch (error) {
              console.error("Error resolving address to name:", error);
              names.set(address, null);
            }
          })
        );

        setRecipientNames(names);
      };

      resolveNames();
    }
  }, [recipients]);

  const suiMailService = new SuiMailService(suiClient);
  const walrusService = new WalrusService();
  const sealService = SealEncryptionService.getInstance(suiClient);
  const suiNsService = new SuiNsService();

  // Helper function to check if current user is blocked by recipients
  const checkBlockedRecipients = async (recipientAddresses: string[]): Promise<string[]> => {
    if (!currentAccount) return [];

    try {
      const blockedByRecipients: string[] = [];

      // For each recipient, check if they have blocked the current user
      for (const recipientAddress of recipientAddresses) {
        try {
          const recipientProfile = await suiMailService.getUserProfile(recipientAddress);
          if (recipientProfile && recipientProfile.data) {
            // Get recipient's blacklist and check if current user is in it
            const recipientBlockedUsers = await suiMailService.getBlacklistedUsers(recipientProfile.data.objectId);

            if (recipientBlockedUsers.some(blockedUser =>
              blockedUser.toLowerCase() === currentAccount.address.toLowerCase()
            )) {
              blockedByRecipients.push(recipientAddress);
            }
          }
        } catch (error) {
          console.error(`Error checking if blocked by ${recipientAddress}:`, error);
          // Continue checking other recipients
        }
      }

      return blockedByRecipients;
    } catch (error) {
      console.error("Error checking recipient blacklists:", error);
      // If network fails, don't block the user - just let them add recipients
      // The validation will happen again at send time when network might be better
    }

    return [];
  };

  // Show error modal
  const showErrorModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOpen(true);
  };

  const handleAddRecipient = async () => {
    const input = recipientInput.trim();

    if (!input) return;

    // Check if it's a SuiNS name (starts with @) or looks like one
    if (input.startsWith("@") || /^[a-z0-9-]+\.(sui)$/.test(input)) {
      try {
        const result = await suiNsService.resolveRecipient(input);
        if (!result) {
          alert(`Could not resolve SuiNS name: ${input}`);
          return;
        }

        if (recipients.includes(result.address)) {
          showErrorModal("Duplicate Recipient", "This address is already added to the recipients list.");
          return;
        }

        // Check if the address is blocked (with loading state)
        setCheckingBlocklist(true);
        try {
          const blockedRecipients = await checkBlockedRecipients([result.address]);
          if (blockedRecipients.length > 0) {
            showErrorModal(
              "Cannot Send Mail",
              `Cannot send mail to ${result.address.slice(0, 10)}...${result.address.slice(-8)}. This user has blocked you.`
            );
            setRecipientInput(""); // Clear the input field
            return;
          }
        } catch (error) {
          console.error("Error checking blacklist:", error);
          // Continue anyway if check fails
        } finally {
          setCheckingBlocklist(false);
        }

        setRecipients([...recipients, result.address]);
        setRecipientInput("");
        console.log(
          `✅ Resolved SuiNS name ${input} to address ${result.address}`
        );
      } catch (error) {
        console.error("Error resolving SuiNS name:", error);
        alert(`Failed to resolve SuiNS name: ${input}`);
      }
    } else {
      // Handle regular Sui address
      if (!input.startsWith("0x") || input.length < 10) {
        showErrorModal(
          "Invalid Address",
          "Please enter a valid Sui address (starts with 0x) or SuiNS name (like @name.sui)"
        );
        return;
      }

      if (recipients.includes(input)) {
        showErrorModal("Duplicate Recipient", "This address is already added to the recipients list.");
        return;
      }

      // Check if the address is blocked (with loading state)
      setCheckingBlocklist(true);
      try {
        const blockedRecipients = await checkBlockedRecipients([input]);
        if (blockedRecipients.length > 0) {
          showErrorModal(
            "Cannot Send Mail",
            `Cannot send mail to ${input.slice(0, 10)}...${input.slice(-8)}. This user has blocked you.`
          );
          setRecipientInput(""); // Clear the input field
          return;
        }
      } catch (error) {
        console.error("Error checking blacklist:", error);
        // Continue anyway if check fails
      } finally {
        setCheckingBlocklist(false);
      }

      setRecipients([...recipients, input]);
      setRecipientInput("");
    }
  };

  const handleRemoveRecipient = (address: string) => {
    setRecipients(recipients.filter((r) => r !== address));
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRecipient();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        continue;
      }

      setAttachments((prev) => [...prev, file]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!currentAccount) {
      showErrorModal("Wallet Not Connected", "Please connect your wallet first");
      return;
    }

    if (recipients.length === 0) {
      showErrorModal("No Recipients", "Please add at least one recipient");
      return;
    }

    if (!subject.trim()) {
      showErrorModal("Missing Subject", "Please enter a subject");
      return;
    }

    // Check if any recipients are blocked (redundant check since we check on add, but good for safety)
    try {
      const blockedRecipients = await checkBlockedRecipients(recipients);
      if (blockedRecipients.length > 0) {
        const blockedList = blockedRecipients.map(recipient =>
          `${recipient.slice(0, 10)}...${recipient.slice(-8)}`
        ).join(', ');
        showErrorModal(
          "Cannot Send Mail",
          `Cannot send mail to the following users who have blocked you: ${blockedList}. Please remove them from recipients and try again.`
        );
        return;
      }
    } catch (error) {
      console.error("Error checking blacklist:", error);
      // Continue with send if blacklist check fails
    }

    setSending(true);

    try {
      // Step 1: Upload attachments to Walrus
      const uploadedAttachments: AttachmentInfo[] = [];

      for (const file of attachments) {
        setUploading(true);
        const blobId = await walrusService.uploadFile(file);
        uploadedAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          blobId,
        });
      }

      setUploading(false);

      let allowlistId: string;
      let capId: string;

      if (parentMailId) {
        // This is a reply - we need to use the parent mail's allowlist
        console.log("📧 Creating reply - getting parent mail allowlist");

        try {
          const parentMail = await suiMailService.getMailById(parentMailId);
          if (parentMail.data?.content?.fields?.allowlist_id) {
            allowlistId = parentMail.data.content.fields.allowlist_id;
            console.log("✅ Using parent mail allowlist:", allowlistId);

            // For replies, we need to create a new cap for the existing allowlist
            // This is a bit complex, so let's try a different approach
            capId = ""; // We'll handle this differently for replies
          } else {
            throw new Error("Parent mail has no allowlist_id");
          }
        } catch (error) {
          console.error("Failed to get parent mail allowlist:", error);
          // Fallback to creating new allowlist
          console.log("🔄 Falling back to creating new allowlist");
        }
      }

      // If it's not a reply or we failed to get parent allowlist, create a new allowlist
      if (!allowlistId) {
        console.log("🆕 Creating new allowlist for mail");
        const allowlistResult = await new Promise<{
          allowlistId: string;
          capId: string;
        }>((resolve, reject) => {
          const tx = new Transaction();
          const allowlistName = `Mail: ${subject.substring(0, 20)}...`;
          const allowlistDesc = `Created for recipients: ${recipients.length}`;

          tx.moveCall({
            target: `${PACKAGE_ID}::sui_mail::create_allowlist_entry`,
            arguments: [
              tx.pure.string(allowlistName),
              tx.pure.string(allowlistDesc),
            ],
          });

          signAndExecute(
            { transaction: tx as any },
            {
              onSuccess: async (result: any) => {
                try {
                  await new Promise((r) => setTimeout(r, 2000));
                  const txResult = await suiClient.getTransactionBlock({
                    digest: result.digest,
                    options: { showObjectChanges: true },
                  });

                  const allowlist = txResult.objectChanges?.find(
                    (change: any) =>
                      change.type === "created" &&
                      change.objectType?.includes("::sui_mail::Allowlist")
                  );

                  const cap = txResult.objectChanges?.find(
                    (change: any) =>
                      change.type === "created" &&
                      change.objectType?.includes("::sui_mail::Cap")
                  );

                  if (
                    allowlist &&
                    "objectId" in allowlist &&
                    cap &&
                    "objectId" in cap
                  ) {
                    resolve({
                      allowlistId: allowlist.objectId,
                      capId: cap.objectId,
                    });
                  } else {
                    reject(new Error("Allowlist or Cap not found"));
                  }
                } catch (error) {
                  reject(error);
                }
              },
              onError: reject,
            }
          );
        });

        allowlistId = allowlistResult.allowlistId;
        capId = allowlistResult.capId;
      }

      console.log("Allowlist created:", allowlistId, "Cap:", capId);

      // Step 3: Validate against blacklists (if recipients have profiles)
      if (!currentAccount?.address) {
        throw new Error("Wallet not connected");
      }

      const { valid, blocked } = await suiMailService.validateAgainstBlacklists(
        currentAccount.address,
        recipients
      );

      if (blocked.length > 0) {
        const blockedList = blocked
          .map((b) => `${b.recipient.slice(0, 6)}...${b.recipient.slice(-4)}`)
          .join(", ");
        alert(
          `Cannot send mail to the following recipients:\n${blockedList}\n\nReason: ${blocked[0].reason}`
        );
        return;
      }

      if (valid.length === 0) {
        alert("No valid recipients available.");
        return;
      }

      // Step 4: Combine mail content with valid recipients
      let htmlContent = content || "";

      // Get HTML content from Quill editor
      if (quillRef.current) {
        const quillEditor = quillRef.current.getEditor();
        if (quillEditor) {
          htmlContent = quillEditor.root.innerHTML;
        }
      }

      const mailContent = combineMailContent(
        subject,
        htmlContent,
        uploadedAttachments,
        valid // Pass valid recipients to mail content
      );

      const mailJson = stringifyMailContent(mailContent);

      // Check content size
      if (mailJson.length > 1000000) {
        console.warn("Mail content is very large");
      }

      const mailData = stringToUint8Array(mailJson);

      // Step 5: Encrypt mail content using allowlist ID (for seal_approve validation)
      // Use envelope encryption (AES + Seal for the key)
      const { encryptedData, encryptedKey, backupKey } =
        await sealService.encryptLargeDataWithAllowlist(mailData, allowlistId);

      // Step 6: Store encrypted content on Walrus
      const encryptedMailContent: EncryptedMailContent = {
        encryptedData: uint8ArrayToBase64(encryptedData),
        encryptedKey: uint8ArrayToBase64(encryptedKey),
        backupKey: uint8ArrayToBase64(backupKey),
        isEnvelopeEncrypted: true,
      };

      const encryptedJson = JSON.stringify(encryptedMailContent);
      const mailBlobId = await walrusService.uploadText(encryptedJson);

      // Step 7: Send mail - use different approach for replies vs new mail
      let result: { mailId: string } | undefined;

      // Create wrapper function to match expected signature
      const signAndExecuteWrapper = (input: { transaction: Transaction }) => {
        return new Promise<{ digest: string; mailId: string }>(
          (resolve, reject) => {
            signAndExecute(
              {
                transaction: input.transaction as any,
              },
              {
                onSuccess: (result: any) => {
                  if (result.mailId) {
                    resolve(result);
                  } else {
                    // Generate a temporary mailId from the digest if not provided
                    resolve({
                      digest: result.digest,
                      mailId: result.digest, // Use digest as temporary mailId
                    });
                  }
                },
                onError: (error: any) => reject(error),
              }
            );
          }
        );
      };

      if (parentMailId && !capId) {
        // This is a reply in existing allowlist
        console.log("📧 Creating reply mail in existing allowlist");
        result = await suiMailService.createMailInAllowlist(
          allowlistId,
          subject,
          mailBlobId,
          signAndExecuteWrapper
        );
      } else {
        // This is a new mail in new allowlist
        console.log("📧 Creating new mail with new allowlist");
        result = (await suiMailService.addMembersAndSendMail(
          allowlistId,
          capId,
          currentAccount.address,
          valid, // Only send to valid recipients
          subject,
          mailBlobId,
          signAndExecuteWrapper
        )) as any;
      }

      // Step 8: If this is a reply, add reply relationship
      if (parentMailId && result?.mailId) {
        try {
          console.log("🔗 Setting up reply relationship:", {
            parentMailId,
            replyMailId: result.mailId,
          });

          // Use the SuiMailService addReplyRelationship method to link the two mails
          (await suiMailService.addReplyRelationship(
            parentMailId,
            result.mailId,
            async ({ transaction }) => {
              const result = (await signAndExecute({
                transaction: transaction as any,
              })) as any;
              return { digest: result.digest || "mock-digest" };
            }
          )) as any;
          console.log("✅ Reply relationship established successfully");
        } catch (replyError) {
          console.error(
            "❌ Failed to establish reply relationship:",
            replyError
          );
          console.error("Reply error details:", {
            message: replyError.message,
            stack: replyError.stack,
          });

          // Try to understand the error better
          if (replyError.message?.includes("EInvalidCap")) {
            console.warn(
              "⚠️ Allowlist mismatch - parent and reply mail are from different allowlists"
            );
          }

          // Don't fail the whole operation if reply linking fails
          alert(
            "Mail sent successfully! However, reply linking failed. The mail was still delivered correctly."
          );
        }
      }

      alert("Mail sent successfully! (Encrypted with Seal)");

      // Reset form
      setRecipients([]);
      setRecipientNames(new Map());
      setSubject("");
      setContent("");
      setAttachments([]);
    } catch (error) {
      console.error("Failed to send mail:", error);
      alert("Failed to send mail. Please try again.");
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "bullet",
    "indent",
    "link",
    "image",
  ];

  return (
    <div className="p-8 h-full flex flex-col">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Compose</h1>
      </header>

      <div className="flex-1 flex flex-col gap-6 bg-white">
        <div className="space-y-2">
          <div>
            <input
              type="text"
              placeholder={
                checkingBlocklist
                  ? "Checking if address is blocked..."
                  : "0x... or @name.sui then press Enter to add each address or @domain.sui"
              }
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleRecipientKeyDown}
              disabled={checkingBlocklist}
              className={`w-full text-normal py-2 border-b border-gray focus:outline-none focus:border-black transition-colors placeholder:text-gray-400 ${
                checkingBlocklist ? "disabled:cursor-not-allowed opacity-60" : ""
              }`}
            />
            {checkingBlocklist && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Loader2 size={16} className="animate-spin" />
                <span>Checking blacklist...</span>
              </div>
            )}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {recipients.map((address, index) => {
                  const suinsName = recipientNames.get(address);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-sm"
                    >
                      <span className="text-black font-mono">
                        {suinsName ? (
                          <>
                            <span className="text-blue-600">{suinsName}</span>
                            <span className="text-gray-500 text-xs">
                              ({address.slice(0, 6)}...{address.slice(-4)})
                            </span>
                          </>
                        ) : (
                          `${address.slice(0, 6)}...${address.slice(-4)}`
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveRecipient(address)}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-normal font-semibold py-2 border-b border-gray focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 relative">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            className="h-[calc(100%-3rem)]"
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">Attachments</h3>
            <div className="space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveAttachment(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={handleFileSelect}
              variant="outline"
              disabled={uploading || sending}
            >
              <Paperclip size={20} />
              <span>Attach</span>
            </Button>
          </div>

          <Button
            onClick={handleSend}
            variant="outline"
            disabled={
              uploading || sending || recipients.length === 0 || !subject.trim()
            }
          >
            {uploading || sending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{uploading ? "Uploading..." : "Sending..."}</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Send</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        message={modalMessage}
      />
    </div>
  );
};

export default Compose;
