# Mail Decryption Implementation Guide

## Overview

The Sui Mail app now supports end-to-end encrypted mail with Seal SDK decryption. This guide explains how the decryption flow works and how to use it.

## Architecture

### Services

#### 1. **MailDecryptionService** (`src/services/mailDecryptionService.ts`)

Central service for decrypting received mails using Seal SDK.

**Key Methods:**

- `initializeSessionKey()` - Creates a session key for batch decryption (10-minute TTL)
- `decryptMail()` - Decrypts a single mail blob
- `getSessionKey()` - Returns current session key
- `clearSessionKey()` - Clears expired session

**Decryption Flow:**

1. Download encrypted blob from Walrus
2. Parse JSON structure: `{encryptedData, encryptedKey, backupKey, isEnvelopeEncrypted}`
3. Convert base64 strings to Uint8Array
4. Build PTB calling `seal_approve` for authorization
5. Decrypt envelope encryption (AES key decrypted with Seal)
6. Decrypt mail content with AES key
7. Parse decrypted JSON as MailContent

#### 2. **SealEncryptionService** (`src/services/sealService.ts`)

Wrapper around Seal SDK for encryption/decryption operations.

**New Method:**

- `createSessionKey()` - Creates SessionKey with user signature

### Storage Format

Encrypted mails are stored in Walrus as JSON:

```json
{
  "encryptedData": "base64...", // AES-GCM encrypted mail content
  "encryptedKey": "base64...", // Seal-encrypted AES key
  "backupKey": "base64...", // Backup encryption
  "isEnvelopeEncrypted": true
}
```

## User Flow

### Viewing Encrypted Mails

1. **Navigate to Inbox/Sent**

   - Encrypted mails show placeholder: "🔒 Click 'Initialize Decryption' to view encrypted mail content"

2. **Initialize Decryption Session**

   - Click "Initialize Decryption" button in header
   - Wallet prompts for personal message signature
   - Sign the message to authorize decryption
   - Status changes to "🔓 Decryption Active"

3. **View Decrypted Content**
   - Mails automatically reload after session initialization
   - Decrypted content displays normally
   - Session lasts 10 minutes before requiring re-initialization

### Authorization

- **Seal Authorization**: Transaction signature proves ownership
- **Smart Contract**: `seal_approve` validates allowlist membership
- **Access Control**: Only allowlist members can decrypt
- **Session Key**: Reusable for multiple decryptions (10-min TTL)

## Technical Details

### Seal SDK Integration

**SessionKey Creation:**

```typescript
const sessionKey = await SessionKey.create({
  address: userAddress,
  packageId: PACKAGE_ID.replace("0x", ""),
  ttlMin: 10,
  suiClient,
});
const message = sessionKey.getPersonalMessage();
const { signature } = await signPersonalMessage(message);
sessionKey.setPersonalMessageSignature(signature);
```

**PTB for seal_approve:**

```typescript
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::sui_mail::seal_approve`,
  arguments: [
    tx.pure.vector("u8", fromHEX(allowlistId.replace("0x", ""))),
    tx.object(allowlistId),
  ],
});
const txBytes = await tx.build({
  client: suiClient,
  onlyTransactionKind: true,
});
```

**Decryption:**

```typescript
const decryptedData = await sealService.decryptLargeData(
  encryptedData,
  encryptedKey,
  sessionKey,
  txBytes
);
```

### Error Handling

The implementation gracefully handles:

- ✅ Expired Walrus blobs (retry with exponential backoff)
- ✅ User cancels signing
- ✅ Decryption failures (falls back to plain download)
- ✅ Missing allowlist (shows encrypted placeholder)
- ✅ Corrupted encrypted data
- ✅ Session key expiration

### Performance Optimizations

- **Session Reuse**: Single SessionKey for multiple decryptions
- **Lazy Loading**: Only initialize session when needed
- **Fallback**: Attempts plain download if decryption fails
- **Caching**: Decrypted content cached in component state

## Configuration

**Seal Configuration** (`src/config/constants.ts`):

```typescript
export const SEAL_CONFIG = {
  PACKAGE_ID:
    "0x927a54e9ae803f82ebf480136a9bcff45101ccbe28b13f433c89f5181069d682",
  KEY_SERVER_IDS: [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
  ],
  THRESHOLD: 2,
};
```

## Testing

### Manual Test Steps

1. **Send Encrypted Mail**

   - Compose → Add recipients → Send
   - Mail encrypted with Seal + stored in Walrus

2. **View in Sent**

   - Navigate to Sent page
   - Click "Initialize Decryption"
   - Sign personal message
   - Verify mail content displays correctly

3. **View in Inbox** (as recipient)

   - Navigate to Inbox
   - Click "Initialize Decryption"
   - Sign personal message
   - Verify received mail content displays

4. **Session Expiry**
   - Wait 10 minutes
   - Verify "Initialize Decryption" button reappears
   - Re-initialize and verify decryption works again

### Expected Logs

**Successful Decryption:**

```
✅ Decryption session initialized
✅ Walrus download successful on attempt 1
✅ Mail decrypted successfully: NW6D3XEFvptbLWRTD4W51eNHGypSQcNx-aLexzuK_Fs
```

**Fallback to Plain Download:**

```
⚠️ Decryption failed, trying plain download: [error details]
✅ Walrus download successful on attempt 1
```

## Security Considerations

1. **End-to-End Encryption**: Content encrypted before upload
2. **Allowlist Authorization**: Only members can decrypt
3. **Session Security**: 10-minute TTL minimizes exposure
4. **Transaction Proof**: Signature validates ownership
5. **No Key Storage**: Session keys never persisted

## Troubleshooting

### "Initialize Decryption" doesn't work

- Check wallet is connected
- Verify user is in mail allowlist
- Check browser console for errors

### Decryption fails

- Verify Seal configuration is correct
- Check allowlist ID is valid
- Ensure SessionKey signature is valid
- Try clearing session and re-initializing

### Old mails show as encrypted

- These may have expired Walrus blobs
- Walrus testnet has limited retention period
- Can't decrypt expired blobs

## Next Steps

Future improvements:

- [ ] Persist SessionKey in IndexedDB for cross-tab sharing
- [ ] Batch decryption with `fetchKeys()` for performance
- [ ] Progress indicator for decrypting multiple mails
- [ ] Better error messages for specific failure cases
- [ ] Auto-refresh session before expiry
