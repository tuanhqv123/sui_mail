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
 * Service for decrypting received mails using Seal SDK
 */
export class MailDecryptionService {
  private sealService: SealEncryptionService;
  private walrusService: WalrusService;
  private sessionKey: SessionKey | null = null;
  private suiClient: any;

  constructor(suiClient: any) {
    this.suiClient = suiClient;
    this.sealService = SealEncryptionService.getInstance(suiClient);
    this.walrusService = new WalrusService();
  }

  /**
   * Initialize session key for decryption
   */
  async initializeSessionKey(
    userAddress: string,
    signPersonalMessage: (message: Uint8Array) => Promise<{ signature: string }>
  ): Promise<void> {
    this.sessionKey = await SealEncryptionService.createSessionKey(
      userAddress,
      this.suiClient,
      signPersonalMessage
    );
  }

  /**
   * Extract JSON content from multipart form-data response
   */
  private extractJsonFromMultipart(text: string): string {
    if (text.includes('Content-Disposition: form-data')) {
      const lines = text.split('\n');
      let jsonStartIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('------WebKit') ||
            lines[i].includes('Content-Disposition') ||
            lines[i].includes('Content-Type')) {
          continue;
        }
        if (lines[i].trim() === '' && i < lines.length - 1) {
          jsonStartIndex = i + 1;
          break;
        }
      }

      if (jsonStartIndex !== -1) {
        const jsonContent = lines.slice(jsonStartIndex).join('\n');
        const cleanedJson = jsonContent.split('\n')
          .filter(line => !line.startsWith('------'))
          .join('\n')
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
    if (!this.sessionKey) {
      throw new Error("Session key not initialized. Call initializeSessionKey first.");
    }

    // Download encrypted mail from Walrus
    let encryptedJson = await this.walrusService.downloadBlobAsText(blobId);
    encryptedJson = this.extractJsonFromMultipart(encryptedJson);

    const encryptedMailContent: EncryptedMailContent = JSON.parse(encryptedJson);

    if (!encryptedMailContent.isEnvelopeEncrypted) {
      throw new Error("Non-envelope encrypted mails not yet supported");
    }

    // Convert base64 to Uint8Array
    const encryptedData = base64ToUint8Array(encryptedMailContent.encryptedData);
    const encryptedKey = base64ToUint8Array(encryptedMailContent.encryptedKey || "");

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

  /**
   * Clear session key
   */
  clearSessionKey(): void {
    this.sessionKey = null;
  }
}
