import { useState, useRef, useMemo } from "react";
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
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl } from "@mysten/sui/client";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { SealEncryptionService } from "../services/sealService";
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

const Compose = () => {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Create SuiJsonRpcClient for Seal SDK
  const sealClient = useMemo(
    () =>
      new SuiJsonRpcClient({
        url: getFullnodeUrl("testnet"),
        network: "testnet",
      }),
    []
  );

  const suiMailService = new SuiMailService(suiClient);
  const walrusService = new WalrusService();
  const sealService = new SealEncryptionService(sealClient);

  const handleAddRecipient = () => {
    const address = recipientInput.trim();

    if (!address) return;

    // Basic validation for Sui address format
    if (!address.startsWith("0x") || address.length < 10) {
      alert("Please enter a valid Sui address (starts with 0x)");
      return;
    }

    if (recipients.includes(address)) {
      alert("This address is already added");
      return;
    }

    setRecipients([...recipients, address]);
    setRecipientInput("");
  };

  const handleRemoveRecipient = (address: string) => {
    setRecipients(recipients.filter((r) => r !== address));
  };

  const handleRecipientKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
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
      alert("Please connect your wallet first");
      return;
    }

    if (recipients.length === 0) {
      alert("Please add at least one recipient");
      return;
    }

    if (!subject.trim()) {
      alert("Please enter a subject");
      return;
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

      // Step 2: Create allowlist first (we need its ID for encryption)
      const { allowlistId, capId } = await new Promise<{
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
        const blockedList = blocked.map(b =>
          `${b.recipient.slice(0, 6)}...${b.recipient.slice(-4)}`
        ).join(", ");
        alert(`Cannot send mail to the following recipients:\n${blockedList}\n\nReason: ${blocked[0].reason}`);
        return;
      }

      if (valid.length === 0) {
        alert("No valid recipients available.");
        return;
      }

      // Step 4: Combine mail content with valid recipients
      let htmlContent = content || '';

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

      // Step 7: Add members and send mail using address-based functions
      await suiMailService.addMembersAndSendMail(
        allowlistId,
        capId,
        currentAccount.address,
        valid, // Only send to valid recipients
        subject,
        mailBlobId,
        signAndExecute
      );

      alert("Mail sent successfully! (Encrypted with Seal)");

      // Reset form
      setRecipients([]);
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
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Compose</h1>
      </header>

      <div className="flex-1 flex flex-col gap-6 bg-white rounded-2xl p-8 shadow-sm border border-gray">
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To (press Enter to add each address)
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleRecipientKeyDown}
              className="w-full text-normal py-2 border-b border-gray focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
            />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {recipients.map((address, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-sm"
                  >
                    <span className="text-black font-mono">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    <button
                      onClick={() => handleRemoveRecipient(address)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
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

        <div className="flex justify-between items-center pt-4">
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
    </div>
  );
};

export default Compose;
