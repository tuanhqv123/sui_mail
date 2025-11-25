import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";

export const PACKAGE_ID = "0xf1a495ce4d313aa180110e69530cb903ea5fe3eab2a1425d6b2fcb20cdd41d54";
// Sui Network Configuration
const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
     testnet: {
          url: getFullnodeUrl("testnet"),
     },
     mainnet: {
          url: getFullnodeUrl("mainnet"),
     },
});

export { networkConfig, useNetworkVariable, useNetworkVariables };

// Walrus Configuration
export const WALRUS_PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
export const WALRUS_AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

// Seal Configuration (Testnet)
export const SEAL_PACKAGE_ID = "0x927a54e9ae803f82ebf480136a9bcff45101ccbe28b13f433c89f5181069d682";

// Seal Key Server Object IDs (Testnet Open Mode)
// Replace these with your own if using permissioned servers
export const SEAL_KEY_SERVER_IDS = [
     "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
     "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

// Seal encryption threshold (number of key servers needed for decryption)
export const SEAL_THRESHOLD = 2;
