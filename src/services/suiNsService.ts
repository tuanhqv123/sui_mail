/**
 * SuiNS Service for resolving Sui addresses to names
 */

export class SuiNsService {
  private baseUrl = "https://suins.id/api/v1";

  async resolveAddressToName(address: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/resolve/address/${address}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.name || null;
    } catch (error) {
      console.error("Error resolving SuiNS name:", error);
      return null;
    }
  }

  async resolveNameToAddress(name: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/resolve/name/${name}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.address || null;
    } catch (error) {
      console.error("Error resolving SuiNS address:", error);
      return null;
    }
  }

  formatAddress(address: string, suinsName?: string | null): string {
    if (suinsName) {
      return suinsName;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatFullAddress(address: string, suinsName?: string | null): string {
    if (suinsName) {
      return `${suinsName} (${address.slice(0, 6)}...${address.slice(-4)})`;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}