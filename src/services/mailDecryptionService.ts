import { Transaction } from "@mysten/sui/transactions";
import { SessionKey } from "@mysten/seal";
import { SealEncryptionService } from "./sealService";
import { WalrusService } from "./walrusService";
import {
  type EncryptedMailContent,
  base64ToUint8Array,
  uint8ArrayToString,
  parseMailContent,
  type MailContent,
} from "../utils/encryption";
import { PACKAGE_ID } from "../config/constants";
import { fromHEX } from "@mysten/bcs";

/**
 * Cached session key data
 */
interface CachedSessionKey {
  sessionKey: SessionKey;
  expiresAt: number; // Timestamp when it expires
}

/**
 * Stored session key data for localStorage persistence
 */
interface StoredSessionKey {
  sessionKeyData: string; // Serialized session key data
  expiresAt: number; // Timestamp when it expires
  userAddress: string; // User address for validation
}

/**
 * Service for decrypting received mails using Seal SDK
 */
export class MailDecryptionService {
  private sealService: SealEncryptionService;
  private walrusService: WalrusService;
  private sessionKey: SessionKey | null = null;
  private suiClient: any;
  private cachedSessionKey: CachedSessionKey | null = null;
  private static readonly SESSION_KEY_TTL_MINUTES = 30; // 30 minutes TTL as per Seal recommendation
  private isInitializing: boolean = false; // Prevent multiple simultaneous initializations
  private static readonly STORAGE_KEY = "sui_mail_session_key"; // localStorage key

  // Singleton pattern
  private static instance: MailDecryptionService | null = null;

  private constructor(suiClient: any) {
    this.suiClient = suiClient;
    this.sealService = SealEncryptionService.getInstance(suiClient);
    this.walrusService = new WalrusService();

    // Try to load cached session key from localStorage on initialization
    this.loadSessionKeyFromStorage();
  }

  /**
   * Get singleton instance to ensure all components share the same session key
   */
  static getInstance(suiClient: any): MailDecryptionService {
    if (!MailDecryptionService.instance) {
      MailDecryptionService.instance = new MailDecryptionService(suiClient);
    }
    return MailDecryptionService.instance;
  }

  /**
   * Reset singleton (for testing or logout)
   */
  static resetInstance(): void {
    if (MailDecryptionService.instance) {
      MailDecryptionService.instance.clearSessionKey();
      MailDecryptionService.instance = null;
    }
  }

  /**
   * Save session key to localStorage for persistence
   */
  private saveSessionKeyToStorage(
    sessionKey: SessionKey,
    userAddress: string
  ): void {
    try {
      // According to Seal docs, SessionKey should be stored using IndexedDB for persistence
      // For localStorage, we'll try a different approach using base64 encoding
      console.log(
        "⚠️ SessionKey localStorage persistence not fully supported - using memory caching only"
      );

      // For now, skip localStorage and rely on in-memory caching
      // SessionKey requires special serialization that localStorage doesn't support well
      console.log(
        "💾 Session key cached in memory only (localStorage skipped)"
      );
    } catch (error) {
      console.warn("Failed to save session key to localStorage:", error);
    }
  }

  /**
   * Load session key from localStorage
   */
  private loadSessionKeyFromStorage(): void {
    try {
      console.log(
        "⚠️ SessionKey localStorage loading skipped - using memory caching only"
      );
      // SessionKey persistence requires IndexedDB or special handling
      // We'll rely on in-memory caching and singleton pattern instead
    } catch (error) {
      console.warn("Failed to load session key from localStorage:", error);
      // Remove corrupted data
      localStorage.removeItem(MailDecryptionService.STORAGE_KEY);
    }
  }

  /**
   * Remove session key from localStorage
   */
  private clearSessionKeyFromStorage(): void {
    try {
      localStorage.removeItem(MailDecryptionService.STORAGE_KEY);
      console.log("🗑️ Session key removed from localStorage");
    } catch (error) {
      console.warn("Failed to clear session key from localStorage:", error);
    }
  }

  /**
   * Check if cached session key is still valid
   */
  private isSessionKeyValid(): boolean {
    if (!this.cachedSessionKey) return false;

    const now = Date.now();
    const isValid = now < this.cachedSessionKey.expiresAt;

    console.log("🔍 Session key validation:", {
      now,
      expiresAt: this.cachedSessionKey.expiresAt,
      isValid,
      remainingMinutes: Math.floor(
        (this.cachedSessionKey.expiresAt - now) / (1000 * 60)
      ),
    });

    // If expired, clear it from memory and localStorage
    if (!isValid) {
      console.log("🕐 Session key expired, clearing cache");
      this.cachedSessionKey = null;
      this.sessionKey = null;
      this.clearSessionKeyFromStorage();
    }

    return isValid;
  }

  /**
   * Clear session key (for manual logout or security reasons)
   */
  clearSessionKey(): void {
    console.log("🗑️ Manually clearing session key");
    this.cachedSessionKey = null;
    this.sessionKey = null;
    this.clearSessionKeyFromStorage();
  }

  /**
   * Cache the session key with expiration
   */
  private cacheSessionKey(sessionKey: SessionKey, userAddress: string): void {
    const expiresAt =
      Date.now() + MailDecryptionService.SESSION_KEY_TTL_MINUTES * 60 * 1000;
    this.cachedSessionKey = { sessionKey, expiresAt };

    // Also save to localStorage for persistence
    this.saveSessionKeyToStorage(sessionKey, userAddress);

    console.log(
      "💾 Session key cached, expires at:",
      new Date(expiresAt).toLocaleString()
    );
  }

  /**
   * Initialize session key for decryption with caching
   */
  async initializeSessionKey(
    userAddress: string,
    signPersonalMessage: (input: {
      message: Uint8Array;
    }) => Promise<{ signature: string }>
  ): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log(
        "⏳ Session key initialization already in progress, waiting..."
      );

      // Wait for initialization to complete (polling approach)
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // If after waiting we have a valid session key, return it
      if (this.isSessionKeyValid()) {
        console.log("♻️ Using session key from previous initialization");
        this.sessionKey = this.cachedSessionKey!.sessionKey;
        return;
      }
    }

    // Check if we have a valid cached session key
    if (this.isSessionKeyValid()) {
      console.log("♻️ Using cached session key (from localStorage or memory)");
      this.sessionKey = this.cachedSessionKey!.sessionKey;
      return;
    }

    this.isInitializing = true;
    console.log("🔐 Creating new session key");

    try {
      this.sessionKey = await SealEncryptionService.createSessionKey(
        userAddress,
        signPersonalMessage
      );

      // Cache the new session key with user address for localStorage persistence
      this.cacheSessionKey(this.sessionKey, userAddress);
      console.log("✅ Session key initialized and cached successfully");
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Extract JSON content from multipart form-data response
   */
  private extractJsonFromMultipart(text: string): string {
    if (text.includes("Content-Disposition: form-data")) {
      const lines = text.split("\n");
      let jsonStartIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].includes("------WebKit") ||
          lines[i].includes("Content-Disposition") ||
          lines[i].includes("Content-Type")
        ) {
          continue;
        }
        if (lines[i].trim() === "" && i < lines.length - 1) {
          jsonStartIndex = i + 1;
          break;
        }
      }

      if (jsonStartIndex !== -1) {
        const jsonContent = lines.slice(jsonStartIndex).join("\n");
        const cleanedJson = jsonContent
          .split("\n")
          .filter((line) => !line.startsWith("------"))
          .join("\n")
          .trim();

        return cleanedJson;
      }
    }

    return text;
  }

  /**
   * Download and decrypt mail content from Walrus
   */
  async decryptMail(blobId: string, allowlistId: string): Promise<MailContent> {
    // Check if session key is initialized and valid
    if (!this.sessionKey || !this.isSessionKeyValid()) {
      throw new Error(
        "Session key not initialized or expired. Please initialize session first."
      );
    }

    // Download encrypted mail from Walrus
    let encryptedJson = await this.walrusService.downloadBlobAsText(blobId);
    encryptedJson = this.extractJsonFromMultipart(encryptedJson);

    const encryptedMailContent: EncryptedMailContent =
      JSON.parse(encryptedJson);

    if (!encryptedMailContent.isEnvelopeEncrypted) {
      throw new Error("Non-envelope encrypted mails not yet supported");
    }

    // Convert base64 to Uint8Array
    const encryptedData = base64ToUint8Array(
      encryptedMailContent.encryptedData
    );
    const encryptedKey = base64ToUint8Array(
      encryptedMailContent.encryptedKey || ""
    );

    // Build transaction calling seal_approve
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::seal_approve`,
      arguments: [
        tx.pure.vector("u8", fromHEX(allowlistId.replace("0x", ""))),
        tx.object(allowlistId),
      ],
    });

    const txBytes = await tx.build({
      client: this.suiClient,
      onlyTransactionKind: true,
    });

    // Decrypt the envelope encryption
    const decryptedData = await this.sealService.decryptLargeData(
      encryptedData,
      encryptedKey,
      this.sessionKey,
      txBytes
    );

    // Parse the decrypted JSON
    const mailJson = uint8ArrayToString(decryptedData);
    const mailContent = parseMailContent(mailJson);

    return mailContent;
  }

  /**
   * Get session key (for reuse)
   */
  getSessionKey(): SessionKey | null {
    return this.sessionKey;
  }
}
