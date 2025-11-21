import {
  WALRUS_PUBLISHER_URL,
  WALRUS_AGGREGATOR_URL,
} from "../config/constants";

export class WalrusService {
  // Upload blob to Walrus using Publisher HTTP API
  async uploadBlob(data: Uint8Array | Blob): Promise<string> {
    const formData = new FormData();

    if (data instanceof Uint8Array) {
      const blob = new Blob([data as unknown as BlobPart]);
      formData.append("file", blob);
    } else {
      formData.append("file", data);
    }

    const epochs = 5;
    const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}`;

    const response = await fetch(url, {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload to Walrus: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    if (result.newlyCreated) {
      return result.newlyCreated.blobObject.blobId;
    } else if (result.alreadyCertified) {
      return result.alreadyCertified.blobId;
    }

    throw new Error(`Unexpected response from Walrus: ${JSON.stringify(result)}`);
  }

  // Download blob from Walrus using Aggregator HTTP API with retry logic
  async downloadBlob(
    blobId: string,
    retries: number = 3,
    delay: number = 2000
  ): Promise<Uint8Array> {
    const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return new Uint8Array(arrayBuffer);
        }

        if (response.status === 404 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        throw new Error(`Failed to download from Walrus: ${response.status} ${response.statusText}`);
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error("Failed to download from Walrus after all retries");
  }

  // Download blob as text
  async downloadBlobAsText(blobId: string): Promise<string> {
    const data = await this.downloadBlob(blobId);
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  // Download blob as JSON
  async downloadBlobAsJson<T = any>(blobId: string): Promise<T> {
    const text = await this.downloadBlobAsText(blobId);
    return JSON.parse(text);
  }

  // Upload text as blob
  async uploadText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    return await this.uploadBlob(data);
  }

  // Upload JSON as blob
  async uploadJson(data: any): Promise<string> {
    const text = JSON.stringify(data);
    return await this.uploadText(text);
  }

  // Upload file from input
  async uploadFile(file: File): Promise<string> {
    return await this.uploadBlob(file);
  }
}
