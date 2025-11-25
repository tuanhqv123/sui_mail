import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  PACKAGE_ID,
  SEAL_KEY_SERVER_IDS,
  SEAL_THRESHOLD,
} from "../config/constants";

/**
 * SealEncryptionService handles encryption/decryption using Seal SDK
 * Uses envelope encryption: encrypt data with AES, then encrypt the AES key with Seal
 */
export class SealEncryptionService {
  private client: SealClient;
  private suiClient: any;
  private freshClient: SuiClient;
  private static instance: SealEncryptionService | null = null;

  constructor(suiClient: any) {
    this.freshClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    this.suiClient = suiClient;

    this.client = new SealClient({
      suiClient: this.freshClient,
      serverConfigs: SEAL_KEY_SERVER_IDS.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
    });
  }

  /**
   * Get singleton instance to ensure consistent client usage
   */
  static getInstance(suiClient: any): SealEncryptionService {
    if (!SealEncryptionService.instance) {
      SealEncryptionService.instance = new SealEncryptionService(suiClient);
    }
    return SealEncryptionService.instance;
  }

  /**
   * Encrypt data for a specific recipient or identity
   * Returns encrypted object and backup symmetric key
   */
  async encrypt(
    data: Uint8Array,
    recipientAddress: string
  ): Promise<{
    encryptedObject: Uint8Array;
    backupKey: Uint8Array;
  }> {
    // Use recipient address as the identity (without package prefix)
    const id = recipientAddress.replace("0x", "");

    const result = await this.client.encrypt({
      threshold: SEAL_THRESHOLD,
      packageId: PACKAGE_ID.replace("0x", ""),
      id: id,
      data,
    });

    return {
      encryptedObject: result.encryptedObject,
      backupKey: result.key,
    };
  }

  /**
   * Encrypt data for multiple recipients (allowlist)
   * Uses a single encryption with allowlist ID
   */
  async encryptForAllowlist(
    data: Uint8Array,
    allowlistId: string
  ): Promise<{
    encryptedObject: Uint8Array;
    backupKey: Uint8Array;
  }> {
    try {
      // Validate allowlist ID format
      if (!allowlistId || typeof allowlistId !== "string") {
        throw new Error("Invalid allowlist ID: must be a non-empty string");
      }

      // Check if it's a valid hex string (after removing 0x prefix)
      const id = allowlistId.replace("0x", "");
      if (!/^[0-9a-fA-F]+$/.test(id)) {
        throw new Error(
          "Invalid allowlist ID: must be a valid hexadecimal string"
        );
      }

      const result = await this.client.encrypt({
        threshold: SEAL_THRESHOLD,
        packageId: PACKAGE_ID.replace("0x", ""),
        id: id,
        data,
      });

      return {
        encryptedObject: result.encryptedObject,
        backupKey: result.key,
      };
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(
          `Seal encryption failed for allowlist ${allowlistId}: ${error.message}`
        );
      }
      throw new Error(
        `Seal encryption failed for allowlist ${allowlistId}: Unknown error`
      );
    }
  }

  /**
   * Envelope encryption for large data using allowlist ID
   * 1. Generate random AES key
   * 2. Encrypt data with AES
   * 3. Encrypt the AES key with Seal using allowlist ID
   */
  async encryptLargeDataWithAllowlist(
    data: Uint8Array,
    allowlistId: string
  ): Promise<{
    encryptedData: Uint8Array;
    encryptedKey: Uint8Array;
    backupKey: Uint8Array;
  }> {
    // Generate random AES key (32 bytes for AES-256)
    const aesKey = crypto.getRandomValues(new Uint8Array(32));

    // Encrypt data with AES-GCM
    const encryptedData = await this.encryptWithAES(data, aesKey);

    // Encrypt the AES key with Seal using allowlist ID
    const { encryptedObject, backupKey } = await this.encryptForAllowlist(
      aesKey,
      allowlistId
    );

    return {
      encryptedData,
      encryptedKey: encryptedObject,
      backupKey,
    };
  }

  /**
   * Decrypt encrypted data
   */
  async decrypt(
    encryptedBytes: Uint8Array,
    sessionKey: SessionKey,
    txBytes: Uint8Array
  ): Promise<Uint8Array> {
    return await this.client.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });
  }

  /**
   * Helper to create a session key for decryption
   */
  static async createSessionKey(
    suiAddress: string,
    signPersonalMessage: (input: {
      message: Uint8Array;
    }) => Promise<{ signature: string }>
  ): Promise<SessionKey> {
    const freshClient = new SuiClient({ url: getFullnodeUrl("testnet") });

    const sessionKey = await SessionKey.create({
      address: suiAddress,
      packageId: PACKAGE_ID,
      ttlMin: 30,
      suiClient: freshClient,
    });

    const message = sessionKey.getPersonalMessage();
    const signResult = await signPersonalMessage({ message });

    await sessionKey.setPersonalMessageSignature(signResult.signature);
    return sessionKey;
  }

  /**
   * Envelope encryption for large files:
   * 1. Generate random AES key
   * 2. Encrypt data with AES
   * 3. Encrypt the AES key with Seal
   */
  async encryptLargeData(
    data: Uint8Array,
    recipientAddress: string
  ): Promise<{
    encryptedData: Uint8Array;
    encryptedKey: Uint8Array;
    backupKey: Uint8Array;
  }> {
    // Generate random AES key (32 bytes for AES-256)
    const aesKey = crypto.getRandomValues(new Uint8Array(32));

    // Encrypt data with AES-GCM
    const encryptedData = await this.encryptWithAES(data, aesKey);

    // Encrypt the AES key with Seal
    const { encryptedObject, backupKey } = await this.encrypt(
      aesKey,
      recipientAddress
    );

    return {
      encryptedData,
      encryptedKey: encryptedObject,
      backupKey,
    };
  }

  /**
   * Decrypt large data using envelope encryption
   */
  async decryptLargeData(
    encryptedData: Uint8Array,
    encryptedKey: Uint8Array,
    sessionKey: SessionKey,
    txBytes: Uint8Array
  ): Promise<Uint8Array> {
    try {
      // Decrypt the AES key using Seal
      const aesKey = await this.decrypt(encryptedKey, sessionKey, txBytes);

      // Decrypt the data with AES
      const decryptedData = await this.decryptWithAES(encryptedData, aesKey);

      return decryptedData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * AES-GCM encryption helper
   */
  private async encryptWithAES(
    data: Uint8Array,
    key: Uint8Array
  ): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV for GCM
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(key),
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new Uint8Array(data)
    );

    // Combine IV + encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return result;
  }

  /**
   * AES-GCM decryption helper
   */
  private async decryptWithAES(
    encryptedData: Uint8Array,
    key: Uint8Array
  ): Promise<Uint8Array> {
    // Extract IV (first 12 bytes)
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new Uint8Array(ciphertext)
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Create a SessionKey for decryption
   * User must sign a personal message to authorize key access
   */
  async createSessionKey(
    userAddress: string,
    signPersonalMessage: (
      message: Uint8Array
    ) => Promise<{ signature: string }>,
    ttlMin: number = 10
  ): Promise<SessionKey> {
    const createParams = {
      address: userAddress,
      packageId: PACKAGE_ID.replace("0x", ""),
      ttlMin,
      suiClient: this.freshClient,
    };

    let sessionKey: SessionKey;
    try {
      sessionKey = await SessionKey.create(createParams);
    } catch (error) {
      console.error("❌ SessionKey.create failed:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    // Get the message to sign
    const message = sessionKey.getPersonalMessage();

    // User signs the message in wallet
    const { signature } = await signPersonalMessage(message);

    sessionKey.setPersonalMessageSignature(signature);

    return sessionKey;
  }
}
