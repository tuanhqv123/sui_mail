import { useState, useEffect } from "react";
import { SuiNsService } from "../services/suiNsService";

export const useSuiNs = () => {
  const [suiNsService] = useState(() => new SuiNsService());
  const [nameCache, setNameCache] = useState<Map<string, string>>(new Map());

  const resolveAddress = async (address: string): Promise<string | null> => {
    // Check cache first
    if (nameCache.has(address)) {
      return nameCache.get(address)!;
    }

    try {
      const name = await suiNsService.resolveAddressToName(address);
      if (name) {
        setNameCache(prev => new Map(prev.set(address, name)));
      }
      return name;
    } catch (error) {
      console.error("Error resolving address:", error);
      return null;
    }
  };

  const resolveAddresses = async (addresses: string[]): Promise<Map<string, string | null>> => {
    const results = new Map<string, string | null>();

    await Promise.all(
      addresses.map(async (address) => {
        const name = await resolveAddress(address);
        results.set(address, name);
      })
    );

    return results;
  };

  return {
    resolveAddress,
    resolveAddresses,
    formatAddress: (address: string, suinsName?: string | null) =>
      suiNsService.formatAddress(address, suinsName),
    formatFullAddress: (address: string, suinsName?: string | null) =>
      suiNsService.formatFullAddress(address, suinsName),
  };
};