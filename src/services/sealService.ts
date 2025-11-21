import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  PACKAGE_ID,
  SEAL_PACKAGE_ID,
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
    this.suiClient = suiClient;
    this.freshClient = new SuiClient({ url: getFullnodeUrl("testnet") });

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
    const id = allowlistId.replace("0x", "");

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
    suiClient: any,
    signPersonalMessage: (message: Uint8Array) => Promise<{ signature: string }>
  ): Promise<SessionKey> {
    const freshClient = new SuiClient({ url: getFullnodeUrl("testnet") });

    const sessionKey = await SessionKey.create({
      address: suiAddress,
      packageId: PACKAGE_ID,
      ttlMin: 10,
      suiClient: freshClient,
    });

    const message = sessionKey.getPersonalMessage();
    const signResult = await signPersonalMessage(message);
    const signature = signResult.signature;

    await sessionKey.setPersonalMessageSignature(signature);
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
    suiClient: any,
    ttlMin: number = 10
  ): Promise<SessionKey> {
    console.log("🔐 createSessionKey called:");
    console.log("  - userAddress:", userAddress);
    console.log("  - ttlMin:", ttlMin);

    // Use the fresh client created in constructor (reuse same instance)
    console.log("🔧 Using freshClient from constructor for SessionKey");
    console.log("🔧 Fresh client type:", this.freshClient?.constructor?.name);

    // CRITICAL: packageId MUST match what was used during encryption
    // Our encryption uses PACKAGE_ID (sui_mail package), so SessionKey must use the same
    const createParams = {
      address: userAddress,
      packageId: PACKAGE_ID.replace("0x", ""),
      ttlMin,
      suiClient: this.freshClient,
    };
    console.log("🔧 SessionKey.create params:", {
      address: createParams.address,
      packageId: createParams.packageId,
      ttlMin: createParams.ttlMin,
      suiClientDefined: !!createParams.suiClient,
    });

    let sessionKey: SessionKey;
    try {
      sessionKey = await SessionKey.create(createParams);
      console.log("✅ SessionKey created successfully");
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
    console.log("📝 Personal message to sign:", {
      messageLength: message.length,
      messageHex: Array.from(message.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
    });

    // User signs the message in wallet
    const { signature } = await signPersonalMessage(message);
    console.log("✍️ User signature received:", {
      signatureLength: signature.length,
      signaturePreview: signature.substring(0, 20) + "...",
    });

    // Complete session key initialization
    sessionKey.setPersonalMessageSignature(signature);
    console.log("✅ Signature set on SessionKey");

    // Validate session key by checking its properties
    console.log("🔍 Session key validation:");
    console.log("  - Address matches:", sessionKey.address === userAddress);
    console.log("  - Package ID matches:", sessionKey.packageId === PACKAGE_ID.replace("0x", ""));
    console.log("  - Session key has signature:", !!sessionKey.signature);

    return sessionKey;
  }
}
