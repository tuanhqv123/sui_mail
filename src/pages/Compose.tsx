import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import Button from "../components/Button";
import { Send, Paperclip, X, Loader2, Sparkles } from "lucide-react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
  useResolveSuiNSName,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SuiMailService } from "../services/suiService";
import { useSuiNs } from "../hooks/useSuiNs";
import { WalrusService } from "../services/walrusService";
import { SealEncryptionService } from "../services/sealService";
import { SuiNsService } from "../services/suiNsService";
import { PACKAGE_ID } from "../config/constants";
import { AI_CONFIG, makeAIChatRequest } from "../config/ai";
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

// Extend Window interface for our temporary storage
declare global {
  interface Window {
    replyParentSender?: string;
  }
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
  const [parentMailSender, setParentMailSender] = useState<string | undefined>(
    undefined
  );
  const [parentMailAllowlistId, setParentMailAllowlistId] = useState<
    string | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [checkingBlocklist, setCheckingBlocklist] = useState(false);

  // AI Writing Assistant states
  const [aiAssistant, setAiAssistant] = useState({
    isOpen: false,
    prompt: "",
    isLoading: false,
  });

  const currentAccount = useCurrentAccount();

  // AI Writing Assistant function
  const handleAiWritingAssistance = async () => {
    if (!aiAssistant.prompt.trim()) return;

    setAiAssistant((prev) => ({ ...prev, isLoading: true }));

    try {
      // Get current email content
      const currentContent = quillRef.current?.editor?.root.innerHTML || "";

      // Get current account SuiNS name using the hook data
      let senderInfo = currentAccount?.address || "Unknown";
      if (currentAccount?.address) {
        if (currentAccountSuiNS) {
          senderInfo = `@${currentAccountSuiNS} - ${currentAccount.address}`;
          console.log("🎯 Found SuiNS name for AI:", senderInfo);
        } else if (!suinsPending) {
          senderInfo = `${currentAccount.address}`;
          console.log("📝 No SuiNS name found, using truncated address");
        } else if (suinsPending) {
          senderInfo = `${currentAccount.address.slice(
            0,
            6
          )}...${currentAccount.address.slice(-4)}`;
          console.log("⏳ Still resolving SuiNS name, using truncated address");
        }
      }
      console.log("👤 Final sender info for AI:", senderInfo);

      const emailContext = {
        sender: senderInfo,
        recipients: recipients.join(", "),
        subject: subject,
        currentContent: currentContent.replace(/<[^>]*>/g, ""), // Strip HTML for context
        attachments: attachments.length,
        isReply: !!locationState?.replyTo,
      };

      const systemPrompt = `You are an AI writing assistant for Sui Mail email composer. Help users write professional, effective emails.

Current email context:
- From: ${emailContext.sender}
- To: ${emailContext.recipients}
- Subject: ${emailContext.subject}
- Current content: ${emailContext.currentContent.substring(0, 500)}
- Attachments: ${emailContext.attachments}
- Type: ${emailContext.isReply ? "Reply" : "New email"}

User request: ${aiAssistant.prompt}

CRITICAL OUTPUT REQUIREMENTS:
- Respond ONLY with raw HTML content - NO code blocks, NO backticks, NO markdown formatting
- Do NOT wrap your response in \`\`\`html\`\`\` or any other code blocks
- Use ONLY these HTML tags that Quill editor supports: <p>, <strong>, <em>, <h1>, <h2>, <blockquote>
- DO NOT use <ul>, <ol>, <li> tags - Quill doesn't support them well
- For bullet points: use regular paragraphs with • or - at the start
- For numbered lists: use regular paragraphs with 1., 2., etc. at the start
- For emphasis: use <strong>bold</strong> and <em>italic</em>
- For paragraphs: use <p>your text</p>
- For headings: use <h1>main heading</h1> or <h2>subheading</h2>
- For quotes: use <blockquote>quoted text</blockquote>
- Format for professional email communication
- Keep content concise and focused on the user's request
- Gratitude with name ${emailContext.sender}

Example output format:
<p>Hello team,</p>
<p>I wanted to <strong>follow up</strong> on our discussion.</p>
<h2>Key Points:</h2>
<p>• First important item</p>
<p>• Second important item</p>`;

      console.log("🤖 AI Writing Assistant - System Prompt:");
      console.log(systemPrompt);
      console.log("📧 Email Context:", emailContext);

      // API call to AI using centralized config
      let success = false;
      let result = null;

      // Try with different models and API keys
      for (
        let apiKeyIndex = 0;
        apiKeyIndex < AI_CONFIG.API_KEYS.length && !success;
        apiKeyIndex++
      ) {
        for (
          let modelIndex = 0;
          modelIndex < AI_CONFIG.MODELS.length && !success;
          modelIndex++
        ) {
          try {
            const apiResult = await makeAIChatRequest(
              [{ role: "system", content: systemPrompt }],
              apiKeyIndex,
              modelIndex
            );

            result = apiResult.choices[0]?.message?.content;
            success = true;
          } catch (err) {
            console.warn(
              `AI API failed with key ${apiKeyIndex}, model ${modelIndex}:`,
              err
            );
          }
        }
      }

      if (result && success) {
        // Clean the AI response - remove any code blocks and extra formatting
        let cleanedResult = result
          .replace(/```html\s*/g, "") // Remove ```html markers
          .replace(/```\s*$/g, "") // Remove closing ``` markers
          .replace(/```/g, "") // Remove any remaining ``` markers
          .trim(); // Remove extra whitespace

        // Apply the cleaned AI-generated content to the editor
        if (quillRef.current) {
          // If there's existing content, append with a paragraph break
          if (currentContent && currentContent !== "<p><br></p>") {
            quillRef.current.editor.root.innerHTML += cleanedResult;
          } else {
            quillRef.current.editor.root.innerHTML = cleanedResult;
          }
        }

        // Clear prompt and close assistant
        setAiAssistant({
          isOpen: false,
          prompt: "",
          isLoading: false,
        });
      } else {
        showErrorModal(
          "AI Writing Assistant Failed",
          "AI writing assistance failed. Please try again."
        );
        setAiAssistant((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("AI writing assistance error:", error);
      showErrorModal(
        "AI Writing Assistant Failed",
        "AI writing assistance failed. Please try again."
      );
      setAiAssistant((prev) => ({ ...prev, isLoading: false }));
    }
  };
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { resolveAddress, resolveAddresses, formatAddress } = useSuiNs();

  // Get current account SuiNS name using the built-in hook
  const { data: currentAccountSuiNS, isPending: suinsPending } =
    useResolveSuiNSName(currentAccount?.address || "");

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
  const checkBlockedRecipients = async (
    recipientAddresses: string[]
  ): Promise<string[]> => {
    if (!currentAccount) return [];

    try {
      const blockedByRecipients: string[] = [];

      // For each recipient, check if they have blocked the current user
      for (const recipientAddress of recipientAddresses) {
        try {
          const recipientProfile = await suiMailService.getUserProfile(
            recipientAddress
          );
          if (recipientProfile && recipientProfile.data) {
            // Get recipient's blacklist and check if current user is in it
            const recipientBlockedUsers =
              await suiMailService.getBlacklistedUsers(
                recipientProfile.data.objectId
              );

            if (
              recipientBlockedUsers.some(
                (blockedUser) =>
                  blockedUser.toLowerCase() ===
                  currentAccount.address.toLowerCase()
              )
            ) {
              blockedByRecipients.push(recipientAddress);
            }
          }
        } catch (error) {
          console.error(
            `Error checking if blocked by ${recipientAddress}:`,
            error
          );
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

  // Make compose data available to chat assistant
  useEffect(() => {
    if (window) {
      (window as any).composeData = {
        recipients,
        subject,
        content,
        attachments: attachments.length,
      };
    }
  }, [recipients, subject, content, attachments]);

  const handleAddRecipient = async () => {
    const input = recipientInput.trim();

    if (!input) return;

    // Check if it's a SuiNS name (starts with @) or looks like one
    if (input.startsWith("@") || /^[a-z0-9-]+\.(sui)$/.test(input)) {
      try {
        const result = await suiNsService.resolveRecipient(input);
        if (!result) {
          showErrorModal(
            "SuiNS Resolution Failed",
            `Could not resolve SuiNS name: ${input}`
          );
          return;
        }

        if (recipients.includes(result.address)) {
          showErrorModal(
            "Duplicate Recipient",
            "This address is already added to the recipients list."
          );
          return;
        }

        // Check if the address is blocked (with loading state)
        setCheckingBlocklist(true);
        try {
          const blockedRecipients = await checkBlockedRecipients([
            result.address,
          ]);
          if (blockedRecipients.length > 0) {
            showErrorModal(
              "Cannot Send Mail",
              `Cannot send mail to ${result.address.slice(
                0,
                10
              )}...${result.address.slice(-8)}. This user has blocked you.`
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
        showErrorModal(
          "SuiNS Resolution Failed",
          `Failed to resolve SuiNS name: ${input}`
        );
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
        showErrorModal(
          "Duplicate Recipient",
          "This address is already added to the recipients list."
        );
        return;
      }

      // Check if the address is blocked (with loading state)
      setCheckingBlocklist(true);
      try {
        const blockedRecipients = await checkBlockedRecipients([input]);
        if (blockedRecipients.length > 0) {
          showErrorModal(
            "Cannot Send Mail",
            `Cannot send mail to ${input.slice(0, 10)}...${input.slice(
              -8
            )}. This user has blocked you.`
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
        showErrorModal("Invalid File", validation.error);
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
    console.log("🚀 handleSend started - current states:", {
      sending: true,
      uploading: true,
    });

    if (!currentAccount) {
      console.log("❌ No current account - returning early");
      showErrorModal(
        "Wallet Not Connected",
        "Please connect your wallet first"
      );
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
        const blockedList = blockedRecipients
          .map(
            (recipient) => `${recipient.slice(0, 10)}...${recipient.slice(-8)}`
          )
          .join(", ");
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

      let allowlistId: string | undefined = undefined;
      let capId: string | undefined = undefined;
      let isReply = false; // Clean flag to track if this is a reply

      console.log("🚀 Starting flow analysis - parentMailId:", parentMailId);

      if (parentMailId) {
        // This is a reply - get parent mail's allowlist and reuse it
        console.log("📧 Creating reply - getting parent mail allowlist");
        isReply = true;

        try {
          const parentMail = await suiMailService.getMailById(parentMailId);
          if (parentMail.data?.content?.fields?.allowlist_id) {
            allowlistId = parentMail.data.content.fields.allowlist_id;
            const sender = parentMail.data.content.fields.sender;

            // Store parent mail info for member addition AND for immediate use
            setParentMailSender(sender);
            setParentMailAllowlistId(allowlistId);

            // CRITICAL: Store sender in a ref for immediate access in reply flow
            if (!window.replyParentSender) {
              (window as any).replyParentSender = sender;
            }
            (window as any).replyParentSender = sender;

            console.log(
              "✅ Using parent mail allowlist for reply:",
              allowlistId
            );
            console.log("👤 Parent mail sender:", sender);
            console.log("🔍 Reply flow set - will NOT create new allowlist");
            console.log(
              "🔍 Current state - isReply:",
              isReply,
              "allowlistId:",
              allowlistId
            );
            console.log(
              "📝 Will ensure original sender is member of allowlist"
            );
            // For replies, we don't need a cap since we're using existing allowlist
          } else {
            throw new Error("Parent mail has no allowlist_id");
          }
        } catch (error) {
          console.error("Failed to get parent mail allowlist:", error);
          // Fallback to creating new allowlist
          console.log("🔄 Falling back to creating new allowlist");
          isReply = false; // Reset flag
          allowlistId = undefined; // Reset allowlistId
        }
      }

      // Only create new allowlist if it's NOT a reply and we don't have an allowlist
      if (!isReply && !allowlistId) {
        console.log("🆕 Creating new allowlist for mail (NEW MAIL)");
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
      if (isReply) {
        console.log("📧 Using parent's allowlist for reply:", allowlistId);
      } else {
        console.log("✅ Allowlist created:", allowlistId, "Cap:", capId);
      }

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
        showErrorModal(
          "Blocked Recipients",
          `Cannot send mail to the following recipients:\n${blockedList}\n\nReason: ${blocked[0].reason}`
        );
        return;
      }

      if (valid.length === 0) {
        showErrorModal("No Valid Recipients", "No valid recipients available.");
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

      // Create wrapper function to match expected signature - immediate success reset
      const signAndExecuteWrapper = (input: { transaction: Transaction }) => {
        return new Promise<{ digest: string; mailId: string }>(
          (resolve, reject) => {
            signAndExecute(
              { transaction: input.transaction as any },
              {
                onSuccess: async (result: any) => {
                  console.log("✅ Transaction executed successfully");
                  console.log("🔍 Raw transaction result:", result);

                  // Wait a moment for transaction to be processed, then get mail object ID
                  await new Promise((r) => setTimeout(r, 2000));

                  let actualMailId = "";
                  try {
                    console.log(
                      "🔍 Getting transaction details to find mail object..."
                    );
                    const txResult = await suiClient.getTransactionBlock({
                      digest: result.digest,
                      options: {
                        showEffects: true,
                        showObjectChanges: true,
                      },
                    });

                    // Find created mail object
                    if (txResult.objectChanges) {
                      for (const change of txResult.objectChanges) {
                        if (
                          change.type === "created" &&
                          change.objectType?.includes("::sui_mail::Mail")
                        ) {
                          actualMailId = change.objectId;
                          console.log("✅ Found mail object ID:", actualMailId);
                          break;
                        }
                      }
                    }

                    if (!actualMailId) {
                      console.warn(
                        "⚠️ Could not find mail object in transaction results"
                      );
                    }
                  } catch (error) {
                    console.error("❌ Error getting mail object ID:", error);
                  }

                  const finalResult = {
                    digest: result.digest || "unknown-digest",
                    mailId: actualMailId || result.digest || "unknown-mailId",
                  };
                  console.log(
                    "🎯 Transaction successful, mail sent to:",
                    recipients
                  );
                  console.log("🔍 Mail ID details:", {
                    resultMailId: result.mailId,
                    resultDigest: result.digest,
                    actualMailId,
                    finalResultMailId: finalResult.mailId,
                  });

                  // For new mails, no reply relationship needed
                  if (parentMailId) {
                    console.log(
                      "🔗 This is a reply, relationship handled in reply flow"
                    );
                  }

                  resolve(finalResult);
                },
                onError: (error: any) => {
                  console.error("❌ Transaction execution failed:", error);
                  reject(error);
                },
              }
            );
          }
        );
      };

      // Use different flows based on our clean flag
      if (isReply) {
        // REPLY FLOW: Create new allowlist for reply + add both users as members + establish reply relationship
        const immediateParentSender = (window as any).replyParentSender;
        console.log(
          "📧 REPLY FLOW: Creating new allowlist for reply + adding both users as members + establishing reply relationship"
        );
        console.log(
          "👤 Original sender to add as member:",
          immediateParentSender
        );
        console.log("👤 Current user:", currentAccount?.address);
        console.log("📋 Reply recipients:", recipients);

        // SIMPLIFIED REPLY FLOW: Create reply mail in parent's allowlist + establish reply relationship
        console.log(
          "🚀 SIMPLIFIED REPLY FLOW: Using parent's allowlist + single reply creation"
        );

        // Step 1: Create reply mail in the parent's allowlist (reuse existing infrastructure)
        console.log(
          "📧 Creating reply mail in parent's allowlist:",
          allowlistId
        );

        const replyTx = new Transaction();
        const replyMail = replyTx.moveCall({
          target: `${PACKAGE_ID}::sui_mail::create_mail_entry`,
          arguments: [
            replyTx.pure.string(subject),
            replyTx.pure.string(mailBlobId),
            replyTx.object(allowlistId), // Use parent's allowlist
          ],
        });

        console.log("✅ Reply mail creation transaction prepared");

        const replyMailResult = await new Promise<{
          digest: string;
          mailId: string;
        }>((resolve, reject) => {
          signAndExecute(
            { transaction: replyTx as any },
            {
              onSuccess: async (result: any) => {
                console.log("✅ Reply mail transaction executed successfully");
                console.log("📝 Transaction result:", result);

                // Wait for transaction to be processed
                await new Promise((r) => setTimeout(r, 2000));

                // Extract reply mail ID from transaction
                const txResult = await suiClient.getTransactionBlock({
                  digest: result.digest,
                  options: { showObjectChanges: true },
                });

                let replyMailId = "";
                if (txResult.objectChanges) {
                  for (const change of txResult.objectChanges) {
                    if (
                      change.type === "created" &&
                      change.objectType?.includes("::sui_mail::Mail")
                    ) {
                      replyMailId = change.objectId;
                      console.log("✅ Found reply mail ID:", replyMailId);
                      break;
                    }
                  }
                }

                if (replyMailId) {
                  console.log(
                    "🎉 Reply mail created successfully in parent's allowlist"
                  );
                  resolve({
                    digest: result.digest,
                    mailId: replyMailId,
                  });
                } else {
                  reject(new Error("Failed to extract created reply mail"));
                }
              },
              onError: (error: any) => {
                console.error("❌ Reply mail transaction failed:", error);
                reject(error);
              },
            }
          );
        });

        console.log("📊 Reply creation result:", replyMailResult);

        // Step 2: Establish reply relationship
        console.log("🔍 Checking reply relationship conditions:");
        console.log("  replyMailResult.mailId:", replyMailResult.mailId);
        console.log(
          "  replyMailResult.mailId !== 'unknown-digest':",
          replyMailResult.mailId !== "unknown-digest"
        );
        console.log(
          "  Should proceed:",
          !!replyMailResult.mailId &&
            replyMailResult.mailId !== "unknown-digest"
        );

        if (
          replyMailResult.mailId &&
          replyMailResult.mailId !== "unknown-digest"
        ) {
          console.log("🔗 Establishing reply relationship...");

          const replyTx = new Transaction();
          replyTx.moveCall({
            target: `${PACKAGE_ID}::sui_mail::add_reply_entry`,
            arguments: [
              replyTx.object(parentMailId), // parent_mail
              replyTx.object(replyMailResult.mailId), // reply_mail
            ],
          });

          const relationshipResult = await new Promise<{ digest: string }>(
            (resolve, reject) => {
              signAndExecute(
                { transaction: replyTx as any },
                {
                  onSuccess: (result: any) => {
                    console.log(
                      "✅ Reply relationship established:",
                      result.digest
                    );
                    resolve({ digest: result.digest || "unknown-digest" });
                  },
                  onError: (error: any) => {
                    console.error("❌ Reply relationship failed:", error);
                    reject(error);
                  },
                }
              );
            }
          );

          console.log("🎉 Reply flow completed successfully!");

          // Step 3: Verify the MailReplied event was emitted and trigger refresh
          console.log("🔍 Verifying MailReplied event was emitted...");
          setTimeout(async () => {
            try {
              const replyEvents = await suiClient.queryEvents({
                query: {
                  MoveEventType: `${PACKAGE_ID}::sui_mail::MailReplied`,
                },
              });

              const latestEvent = replyEvents.data[0];
              if (latestEvent?.parsedJson) {
                const eventData = latestEvent.parsedJson as any;
                console.log("✅ Found MailReplied event:", {
                  parent_mail_id: eventData.parent_mail_id,
                  reply_mail_id: eventData.reply_mail_id,
                  sender: eventData.sender,
                  timestamp: eventData.timestamp,
                });

                if (
                  eventData.parent_mail_id === parentMailId &&
                  eventData.reply_mail_id === replyMailResult.mailId
                ) {
                  console.log(
                    "🎯 PERFECT! Reply relationship event matches our transaction"
                  );
                  console.log(
                    "📱 Reply successfully linked - resetting UI state"
                  );

                  // Reset UI state after successful reply
                  setSending(false);
                  setUploading(false);
                  console.log(
                    "🎉 UI states reset - sending:",
                    false,
                    "uploading:",
                    false
                  );

                  // Show success modal
                  setModalTitle("Reply Sent");
                  setModalMessage("Your reply has been sent successfully!");
                  setModalOpen(true);

                  // Reset form
                  setRecipients([]);
                  setRecipientNames(new Map());
                  setSubject("");
                  setContent("");
                  setAttachments([]);

                  console.log(
                    "✅ Reply flow fully completed - UI reset and form cleared"
                  );

                  // Auto-refresh inbox to show new reply
                  console.log("🔄 Auto-refreshing inbox to show new reply...");
                  try {
                    // Trigger a global inbox refresh by updating the window timestamp
                    (window as any).forceInboxRefresh = Date.now();
                    console.log("✅ Inbox refresh triggered");
                  } catch (error) {
                    console.warn("⚠️ Could not trigger inbox refresh:", error);
                  }
                } else {
                  console.warn(
                    "⚠️ Event found but doesn't match our transaction"
                  );

                  // Still reset UI even if event verification failed
                  setSending(false);
                  setUploading(false);
                  setModalTitle("Reply Sent");
                  setModalMessage("Your reply has been sent successfully!");
                  setModalOpen(true);
                  setRecipients([]);
                  setRecipientNames(new Map());
                  setSubject("");
                  setContent("");
                  setAttachments([]);
                }
              } else {
                console.warn("⚠️ No MailReplied events found");

                // Still reset UI even if event verification failed
                setSending(false);
                setUploading(false);
                setModalTitle("Reply Sent");
                setModalMessage("Your reply has been sent successfully!");
                setModalOpen(true);
                setRecipients([]);
                setRecipientNames(new Map());
                setSubject("");
                setContent("");
                setAttachments([]);
              }
            } catch (error) {
              console.error("❌ Error checking MailReplied events:", error);

              // Reset UI even on error
              setSending(false);
              setUploading(false);
            }
          }, 3000);
        } else {
          console.warn(
            "⚠️ No valid reply mail ID - skipping reply relationship"
          );

          // Still reset UI even if reply relationship failed
          setSending(false);
          setUploading(false);
          setModalTitle("Reply Sent");
          setModalMessage("Your reply has been sent successfully!");
          setModalOpen(true);
          setRecipients([]);
          setRecipientNames(new Map());
          setSubject("");
          setContent("");
          setAttachments([]);
        }
      } else {
        // New mail flow: Create new allowlist and add members
        console.log("📧 Creating new mail with new allowlist");
        console.log("📋 Parameters being sent to addMembersAndSendMail:", {
          allowlistId,
          capId,
          senderAddress: currentAccount.address,
          validRecipients: valid,
          subject,
          mailBlobId,
        });

        console.log(
          "🚀 Calling addMembersAndSendMail with proper UI reset handling..."
        );

        // Handle both success and error cases to reset UI
        // IMPORTANT: Pass the actual signAndExecute (callback-based), not the wrapper (Promise-based)
        suiMailService
          .addMembersAndSendMail(
            allowlistId,
            capId,
            currentAccount.address,
            valid, // Only send to valid recipients
            subject,
            mailBlobId,
            signAndExecute
          )
          .then((result) => {
            console.log("✅ New mail sent successfully:", result);

            // Reset UI state after successful send
            setSending(false);
            setUploading(false);
            console.log(
              "🎉 UI states reset - sending:",
              false,
              "uploading:",
              false
            );

            // Show success modal
            setModalTitle("Mail Sent");
            setModalMessage("Your mail has been sent successfully!");
            setModalOpen(true);

            // Reset form
            setRecipients([]);
            setRecipientNames(new Map());
            setSubject("");
            setContent("");
            setAttachments([]);

            console.log(
              "✅ New mail flow fully completed - UI reset and form cleared"
            );

            // Auto-refresh inbox
            try {
              (window as any).forceInboxRefresh = Date.now();
              console.log("✅ Inbox refresh triggered");
            } catch (error) {
              console.warn("⚠️ Could not trigger inbox refresh:", error);
            }
          })
          .catch((error) => {
            console.error("❌ Mail sending failed:", error);
            showErrorModal(
              "Send Failed",
              "Failed to send mail. Please try again."
            );
            setSending(false);
            setUploading(false);
          });
      }

      // Note: UI updates are handled in the promise handlers above
      console.log(
        "📋 Mail sending initiated - UI will be updated after transaction completes"
      );
    } catch (error) {
      console.error("Failed to initiate mail send:", error);
      showErrorModal("Send Failed", "Failed to send mail. Please try again.");
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
                checkingBlocklist
                  ? "disabled:cursor-not-allowed opacity-60"
                  : ""
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

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() =>
                setAiAssistant((prev) => ({ ...prev, isOpen: true }))
              }
              variant="outline"
              disabled={uploading || sending}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
            >
              <Sparkles size={20} />
              <span>Writer</span>
            </Button>
            <Button
              onClick={handleSend}
              variant="outline"
              disabled={
                uploading ||
                sending ||
                recipients.length === 0 ||
                !subject.trim()
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
      </div>

      {/* AI Writing Assistant Modal */}
      {aiAssistant.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-black p-6 w-[500px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black flex items-center gap-2">
                AI Writing Assistant
              </h3>
              <button
                onClick={() =>
                  setAiAssistant((prev) => ({ ...prev, isOpen: false }))
                }
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-2">
                What would you like me to help you write?
              </label>
              <textarea
                value={aiAssistant.prompt}
                onChange={(e) =>
                  setAiAssistant((prev) => ({
                    ...prev,
                    prompt: e.target.value,
                  }))
                }
                placeholder="e.g., 'Write a professional introduction paragraph', 'Expand on this topic'..."
                className="w-full px-3 py-2 border bg-muted border-gray-300 rounded-lg focus:outline-none focus:border-black resize-none h-24"
                disabled={aiAssistant.isLoading}
              />
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Current email:</strong> {subject || "No subject"} →{" "}
                {recipients.join(", ") || "No recipients"}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setAiAssistant((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={aiAssistant.isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAiWritingAssistance}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center rounded-full text-white gap-2"
                disabled={aiAssistant.isLoading || !aiAssistant.prompt.trim()}
                text-white
                border-0
              >
                {aiAssistant.isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Writing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
