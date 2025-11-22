/**
 * SuiNS Service for resolving Sui addresses to names using the official Sui SDK
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SuinsClient } from "@mysten/suins";

export class SuiNsService {
  private client: SuiClient;
  private suinsClient: SuinsClient;

  constructor() {
    // Initialize SuiClient for SuiNS queries
    this.client = new SuiClient({
      url: getFullnodeUrl("testnet"),
    });

    // Initialize official SuinsClient
    this.suinsClient = new SuinsClient({
      client: this.client,
      network: "testnet",
    });
  }

  async resolveAddressToName(_address: string): Promise<string | null> {
    // For now, we'll return null since reverse lookup is not available
    // in the current SuiNS SDK version
    return null;
  }

  async resolveNameToAddress(name: string): Promise<string | null> {
    try {
      // Remove @ prefix if present
      let cleanName = name;
      if (cleanName.startsWith("@")) {
        cleanName = cleanName.substring(1);
      }

      // If it looks like a Sui address, return it directly (users might paste addresses with @)
      if (cleanName.startsWith("0x") && cleanName.length >= 10) {
        return cleanName;
      }

      // Use official SuinsClient as per documentation - pass clean name without @
      const nameRecord = await this.suinsClient.getNameRecord(cleanName);
      if (nameRecord?.targetAddress) {
        return nameRecord.targetAddress;
      }

      return null;
    } catch (error) {
      console.error("Error resolving SuiNS address:", error);
      return null;
    }
  }

  formatAddress(address: string, suinsName?: string | null): string {
    if (suinsName) {
      return `${suinsName} - ${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatFullAddress(address: string, suinsName?: string | null): string {
    if (suinsName) {
      return `${suinsName} - ${address}`;
    }
    return address;
  }

  /**
   * Check if a string is a valid SuiNS name format
   */
  isValidSuiNsName(name: string): boolean {
    // Remove @ if present and check basic format
    const cleanName = name.startsWith("@") ? name.substring(1) : name;
    return /^[a-z0-9-]+\.(sui)$/.test(cleanName);
  }

  /**
   * Enhanced resolution that handles multiple input formats
   */
  async resolveRecipient(
    input: string
  ): Promise<{ address: string; name?: string } | null> {
    const trimmedInput = input.trim();

    // Case 1: It's a SuiNS name
    if (this.isValidSuiNsName(trimmedInput)) {
      const address = await this.resolveNameToAddress(trimmedInput);
      if (address) {
        return {
          address,
          name: trimmedInput.startsWith("@")
            ? trimmedInput
            : `@${trimmedInput}`,
        };
      }
    }

    // Case 2: It's already a Sui address
    if (trimmedInput.startsWith("0x") && trimmedInput.length === 66) {
      const name = await this.resolveAddressToName(trimmedInput);
      return {
        address: trimmedInput,
        name: name || undefined,
      };
    }

    return null;
  }
}
