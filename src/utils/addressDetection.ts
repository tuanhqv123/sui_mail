import { isValidSuiAddress } from "@mysten/sui/utils";

/**
 * Detects Sui addresses in text and replaces them with aliases
 * @param text - The input text to process
 * @returns Object containing processed text and address mapping
 */
export function detectAndReplaceAddresses(text: string): {
  processedText: string;
  addressMap: Record<string, string>;
} {
  const addressMap: Record<string, string> = {};
  let processedText = text;
  let aliasCounter = 1;

  // Regex to match Sui addresses (0x followed by 64 hex characters)
  const addressRegex = /0x[a-fA-F0-9]{64}/g;
  const matches = text.match(addressRegex) || [];

  for (const match of matches) {
    if (isValidSuiAddress(match)) {
      const alias = `address ${aliasCounter}`;
      if (!Object.values(addressMap).includes(match)) {
        addressMap[alias] = match;
        processedText = processedText.replace(new RegExp(match, "g"), alias);
        aliasCounter++;
      }
    }
  }

  return { processedText, addressMap };
}

/**
 * Parses AI response for transfer instructions
 * Expected format: array of {amount: number, to: string} where to is alias
 */
export function parseTransferInstructions(
  response: string
): Array<{ amount: number; to: string }> | null {
  try {
    // Look for JSON array in the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) =>
          typeof item === "object" &&
          typeof item.amount === "number" &&
          typeof item.to === "string"
      );
    }
  } catch (e) {
    console.error("Failed to parse transfer instructions:", e);
  }
  return null;
}
