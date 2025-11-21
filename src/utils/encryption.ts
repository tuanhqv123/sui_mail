// Types for mail content structure
export interface MailContent {
  subject: string;
  body: string; // HTML content from editor
  timestamp: string;
  recipients?: string[]; // Add recipients to mail content
  attachments?: AttachmentInfo[];
}

export interface AttachmentInfo {
  name: string;
  size: number;
  type: string;
  blobId: string; // Walrus blob ID for the file
}

// Combine mail content with attachment info into a single JSON structure
export function combineMailContent(
  subject: string,
  body: string,
  attachments: AttachmentInfo[] = [],
  recipients: string[] = []
): MailContent {
  return {
    subject,
    body,
    timestamp: new Date().toISOString(),
    recipients,
    attachments,
  };
}

// Parse mail content from JSON string
export function parseMailContent(jsonString: string): MailContent {
  return JSON.parse(jsonString);
}

// Convert mail content to JSON string for storage
export function stringifyMailContent(content: MailContent): string {
  return JSON.stringify(content);
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Validate file before upload
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(maxSize)} limit`,
    };
  }

  return { valid: true };
}

// Read file as ArrayBuffer
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Convert string to Uint8Array
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to string
export function uint8ArrayToString(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

// Combine encrypted mail content structure
export interface EncryptedMailContent {
  encryptedData: string; // base64 encoded
  encryptedKey?: string; // base64 encoded (for envelope encryption)
  backupKey?: string; // base64 encoded backup key
  isEnvelopeEncrypted: boolean; // true if using envelope encryption
}

// Helper to convert Uint8Array to base64
export function uint8ArrayToBase64(arr: Uint8Array): string {
  // Use chunked approach to avoid RangeError with large arrays
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks

  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

// Helper to convert base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
