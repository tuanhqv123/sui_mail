import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "../config/constants";

export class SuiMailService {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  // Create user profile
  async createProfile(
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_profile_entry`,
      arguments: [],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Get user cap objects (which contain allowlist_ids)
  async getUserCapObjects(address: string) {
    try {
      // Query owned Cap objects
      const objects = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${PACKAGE_ID}::sui_mail::Cap`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      console.log("User Cap objects:", objects.data);
      return objects.data;
    } catch (error) {
      console.error("Error fetching user cap objects:", error);
      return [];
    }
  }

  // Blacklist user
  async blacklistUser(
    profileId: string,
    blacklistedAddress: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::add_to_blacklist_entry`,
      arguments: [
        tx.object(profileId), // &mut UserProfile (OBJECT)
        tx.pure.address(blacklistedAddress), // address (PURE)
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Remove from blacklist
  async removeFromBlacklist(
    profileId: string,
    blacklistedAddress: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::remove_from_blacklist_entry`,
      arguments: [tx.object(profileId), tx.pure.address(blacklistedAddress)],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Get user profile by address
  async getUserProfile(userAddress: string) {
    try {
      // First try to find profile objects owned by this address (in case some are owned)
      const ownedObjects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${PACKAGE_ID}::sui_mail::UserProfile`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (ownedObjects.data && ownedObjects.data.length > 0) {
        return ownedObjects.data[0].data?.objectId;
      }

      // If no owned profiles, search for shared profiles where this address is the owner
      // Query ProfileCreated events to find profiles created by this address
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::sui_mail::ProfileCreated`,
        },
        options: {
          showContent: true,
        },
      });

      // Find events where this address is the owner
      for (const event of events.data) {
        if (event.parsedJson && event.parsedJson.owner === userAddress) {
          const profileId = event.parsedJson.profile_id;

          // Verify the profile still exists and get its details
          const profileObject = await this.client.getObject({
            id: profileId,
            options: {
              showContent: true,
              showType: true,
            },
          });

          if (profileObject.data && profileObject.data.content) {
            return profileId;
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }

  // Get all blacklisted users for a profile
  async getBlacklistedUsers(profileId: string): Promise<string[]> {
    try {
      // Get dynamic fields from the profile
      const dynamicFields = await this.client.getDynamicFields({
        parentId: profileId,
      });

      const blacklistedAddresses: string[] = [];

      // Extract addresses from BlacklistEntry dynamic fields
      for (const field of dynamicFields.data) {
        // Extract address from the dynamic field name
        let address: string | null = null;

        if (
          field.name?.type === "address" &&
          typeof field.name?.value === "string"
        ) {
          address = field.name.value;
        } else if (
          typeof field.name === "string" &&
          field.name.startsWith("0x")
        ) {
          address = field.name;
        } else if (
          field.name?.value &&
          typeof field.name.value === "string" &&
          field.name.value.startsWith("0x")
        ) {
          address = field.name.value;
        }

        if (address) {
          blacklistedAddresses.push(address);
        }
      }

      return blacklistedAddresses;
    } catch (error) {
      console.error("Error fetching blacklist:", error);
      return [];
    }
  }

  // Check if user is blacklisted
  async isBlacklisted(profileId: string, address: string): Promise<boolean> {
    const profile = await this.client.getObject({
      id: profileId,
      options: {
        showContent: true,
      },
    });

    if (!profile.data || !profile.data.content) return false;

    // Get dynamic fields to check blacklist
    const dynamicFields = await this.client.getDynamicFields({
      parentId: profileId,
    });

    // Check if address exists in blacklist dynamic fields
    for (const field of dynamicFields.data) {
      if (field.name.value === address) {
        return true;
      }
    }

    return false;
  }

  // Get user's allowlists (via Cap objects)
  async getUserAllowlists(address: string) {
    const objects = await this.client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${PACKAGE_ID}::sui_mail::Cap`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    return objects.data;
  }

  // Get allowlist details by ID
  async getAllowlistDetails(allowlistId: string) {
    const allowlist = await this.client.getObject({
      id: allowlistId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    return allowlist;
  }

  // Add member to allowlist
  async addMember(
    allowlistId: string,
    capId: string,
    memberAddress: string,
    memberProfileId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::add_member_entry`,
      arguments: [
        tx.object(allowlistId), // &mut Allowlist
        tx.object(capId), // &Cap
        tx.pure.address(memberAddress), // address (PURE)
        tx.object(memberProfileId), // &UserProfile (OBJECT)
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Remove member from allowlist
  async removeMember(
    allowlistId: string,
    capId: string,
    memberAddress: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::remove_member_entry`,
      arguments: [
        tx.object(allowlistId), // &mut Allowlist (OBJECT)
        tx.object(capId), // &Cap (OBJECT)
        tx.pure.address(memberAddress), // address (PURE)
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Create mail with automatic allowlist and member management
  // Create allowlist and return its ID
  async createAllowlist(
    name: string,
    description: string,
    signAndExecute: any
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_allowlist_entry`,
      arguments: [tx.pure.string(name), tx.pure.string(description)],
    });

    return new Promise<string>((resolve, reject) => {
      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: async (result: any) => {
            try {
              // Wait for transaction to complete
              await new Promise((r) => setTimeout(r, 2000));

              // Get the created allowlist from transaction effects
              const txResult = await this.client.getTransactionBlock({
                digest: result.digest,
                options: {
                  showEffects: true,
                  showObjectChanges: true,
                },
              });

              let allowlistId = "";

              // Find created allowlist
              if (txResult.objectChanges) {
                for (const change of txResult.objectChanges) {
                  if (
                    change.type === "created" &&
                    change.objectType.includes("::sui_mail::Allowlist")
                  ) {
                    allowlistId = change.objectId;
                    break;
                  }
                }
              }

              if (!allowlistId) {
                throw new Error("Failed to find created allowlist");
              }

              resolve(allowlistId);
            } catch (error) {
              reject(error);
            }
          },
          onError: (error: any) => reject(error),
        }
      );
    });
  }

  // Check if sender is blocked by any recipients (blacklist validation)
  async validateAgainstBlacklists(
    senderAddress: string,
    recipientAddresses: string[]
  ): Promise<{
    valid: string[];
    blocked: { recipient: string; reason: string }[];
  }> {
    const valid: string[] = [];
    const blocked: { recipient: string; reason: string }[] = [];

    for (const recipient of recipientAddresses) {
      // Check if recipient has a profile
      const recipientProfiles = await this.client.getOwnedObjects({
        owner: recipient,
        filter: {
          StructType: `${PACKAGE_ID}::sui_mail::UserProfile`,
        },
        options: {
          showContent: true,
        },
      });

      if (recipientProfiles.data.length === 0) {
        // No profile = cannot block sender
        valid.push(recipient);
        continue;
      }

      // Recipient has profile, check if sender is blacklisted
      const profileId = recipientProfiles.data[0].data!.objectId;
      const isBlocked = await this.isBlacklisted(profileId, senderAddress);

      if (isBlocked) {
        blocked.push({
          recipient,
          reason: "You are blocked by this recipient",
        });
      } else {
        valid.push(recipient);
      }
    }

    return { valid, blocked };
  }

  // Add sender to allowlist and send mail using address-based functions
  async addMembersAndSendMail(
    allowlistId: string,
    capId: string,
    senderAddress: string,
    recipients: string[],
    subject: string,
    encryptedBlobId: string,
    signAndExecute: any
  ): Promise<{ recipients: string[] }> {
    const tx = new Transaction();

    // Get existing members to avoid adding duplicates
    const existingMembers = await this.getAllowlistMembers(allowlistId);
    const existingMembersLower = existingMembers.map((m) => String(m).toLowerCase());

    // 1. Add sender as member only if not already a member
    if (!existingMembersLower.includes(senderAddress.toLowerCase())) {
      tx.moveCall({
        target: `${PACKAGE_ID}::sui_mail::add_member_by_address_entry`,
        arguments: [
          tx.object(allowlistId), // &mut Allowlist
          tx.object(capId), // &Cap
          tx.pure.address(senderAddress), // address (PURE)
        ],
      });
    }

    // 2. Add each recipient as member only if not already a member
    for (const recipient of recipients) {
      // Skip if already a member or same as sender
      if (
        recipient === senderAddress ||
        existingMembersLower.includes(recipient.toLowerCase())
      ) {
        continue;
      }

      tx.moveCall({
        target: `${PACKAGE_ID}::sui_mail::add_member_by_address_entry`,
        arguments: [
          tx.object(allowlistId), // &mut Allowlist
          tx.object(capId), // &Cap
          tx.pure.address(recipient), // address (PURE)
        ],
      });
    }

    // 3. Create and send mail
    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_mail_entry`,
      arguments: [
        tx.pure.string(subject), // String (PURE)
        tx.pure.string(encryptedBlobId), // String (PURE)
        tx.object(allowlistId), // &Allowlist (OBJECT)
      ],
    });

    return new Promise<{ recipients: string[]; mailId: string }>(
      (resolve, reject) => {
        signAndExecute(
          { transaction: tx as any },
          {
            onSuccess: async (result: any) => {
              try {
                console.log(
                  "🔍 suiService.addMembersAndSendMail: Transaction success, waiting 2 seconds..."
                );
                // Wait for transaction to complete
                await new Promise((r) => setTimeout(r, 2000));

                console.log(
                  "🔍 suiService.addMembersAndSendMail: Getting transaction block for digest:",
                  result.digest
                );
                console.time(
                  "⏱️ getTransactionBlock call in addMembersAndSendMail"
                );
                // Get the created mail from transaction effects
                const txResult = await this.client.getTransactionBlock({
                  digest: result.digest,
                  options: {
                    showEffects: true,
                    showObjectChanges: true,
                  },
                });
                console.timeEnd(
                  "⏱️ getTransactionBlock call in addMembersAndSendMail"
                );
                console.log(
                  "🔍 suiService.addMembersAndSendMail: Transaction block retrieved successfully"
                );

                let createdMailId = "";

                // Find created mail
                if (txResult.objectChanges) {
                  for (const change of txResult.objectChanges) {
                    if (
                      change.type === "created" &&
                      change.objectType.includes("::sui_mail::Mail")
                    ) {
                      createdMailId = change.objectId;
                      break;
                    }
                  }
                }

                if (!createdMailId) {
                  console.warn(
                    "Could not find created mail ID, but mail was sent"
                  );
                }

                console.log(
                  "🔍 suiService.addMembersAndSendMail: Resolving with result:",
                  {
                    recipients: recipients,
                    mailId: createdMailId,
                  }
                );
                resolve({ recipients: recipients, mailId: createdMailId });
              } catch (error) {
                console.error("Error getting mail ID:", error);
                resolve({ recipients: recipients, mailId: "" });
              }
            },
            onError: (error: any) => reject(error),
          }
        );
      }
    );
  }

  async createMailWithRecipients(
    recipients: string[],
    subject: string,
    encryptedBlobId: string,
    signAndExecute: any
  ) {
    const tx = new Transaction();

    // 1. Create allowlist
    const allowlistName = `Mail: ${subject.substring(0, 20)}...`;
    const allowlistDesc = `Created for recipients: ${recipients.length}`;

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_allowlist_entry`,
      arguments: [tx.pure.string(allowlistName), tx.pure.string(allowlistDesc)],
    });

    // 2. Get allowlist object (it's shared after creation)
    // We need to get it by ID after the transaction
    // For now, we'll create a second transaction for adding members and sending mail

    return new Promise<void>((resolve, reject) => {
      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: async (result: any) => {
            try {
              // Wait for transaction to complete and get created objects
              await new Promise((r) => setTimeout(r, 2000));

              // Get the created allowlist and cap from transaction effects
              const txResult = await this.client.getTransactionBlock({
                digest: result.digest,
                options: {
                  showEffects: true,
                  showObjectChanges: true,
                },
              });

              let createdAllowlistId = "";
              let createdCapId = "";

              // Find created objects
              if (txResult.objectChanges) {
                for (const change of txResult.objectChanges) {
                  if (
                    change.type === "created" &&
                    change.objectType.includes("::sui_mail::Allowlist")
                  ) {
                    createdAllowlistId = change.objectId;
                  }
                  if (
                    change.type === "created" &&
                    change.objectType.includes("::sui_mail::Cap")
                  ) {
                    createdCapId = change.objectId;
                  }
                }
              }

              if (!createdAllowlistId || !createdCapId) {
                throw new Error("Failed to find created allowlist or cap");
              }

              // 3. Add members and send mail in a new transaction
              const tx2 = new Transaction();

              // Add each recipient as member
              for (const recipient of recipients) {
                // Get recipient's profile
                const recipientProfiles = await this.client.getOwnedObjects({
                  owner: recipient,
                  filter: {
                    StructType: `${PACKAGE_ID}::sui_mail::UserProfile`,
                  },
                  options: {
                    showContent: true,
                  },
                });

                if (recipientProfiles.data.length > 0) {
                  const profileId = recipientProfiles.data[0].data.objectId;

                  tx2.moveCall({
                    target: `${PACKAGE_ID}::sui_mail::add_member_entry`,
                    arguments: [
                      tx2.object(createdAllowlistId), // &mut Allowlist
                      tx2.object(createdCapId), // &Cap
                      tx2.pure.address(recipient), // address (PURE)
                      tx2.object(profileId), // &UserProfile (OBJECT)
                    ],
                  });
                }
              }

              // 4. Create and send mail
              tx2.moveCall({
                target: `${PACKAGE_ID}::sui_mail::create_mail_entry`,
                arguments: [
                  tx2.pure.string(subject), // String (PURE)
                  tx2.pure.string(encryptedBlobId), // String (PURE)
                  tx2.object(createdAllowlistId), // &Allowlist (OBJECT)
                ],
              });

              // Execute second transaction
              signAndExecute(
                { transaction: tx2 as any },
                {
                  onSuccess: () => resolve(),
                  onError: (error: any) => reject(error),
                }
              );
            } catch (error) {
              reject(error);
            }
          },
          onError: (error: any) => reject(error),
        }
      );
    });
  }

  // Create mail
  async createMail(
    allowlistId: string,
    subject: string,
    encryptedBlobId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_mail_entry`,
      arguments: [
        tx.pure.string(subject), // String (PURE)
        tx.pure.string(encryptedBlobId), // String (PURE)
        tx.object(allowlistId), // &Allowlist (OBJECT)
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Create mail in existing allowlist (for replies)
  async createMailInAllowlist(
    allowlistId: string,
    subject: string,
    encryptedBlobId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string; mailId: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_mail_entry`,
      arguments: [
        tx.pure.string(subject), // String (PURE)
        tx.pure.string(encryptedBlobId), // String (PURE)
        tx.object(allowlistId), // &Allowlist (OBJECT)
      ],
    });

    return new Promise<{ digest: string; mailId: string }>(
      (resolve, reject) => {
        (signAndExecute as any)(
          { transaction: tx as any },
          {
            onSuccess: async (result: any) => {
              try {
                // Wait for transaction to complete
                await new Promise((r) => setTimeout(r, 2000));

                // Get the created mail from transaction effects
                const txResult = await this.client.getTransactionBlock({
                  digest: result.digest,
                  options: {
                    showEffects: true,
                    showObjectChanges: true,
                  },
                });

                let createdMailId = "";

                // Find created mail
                if (txResult.objectChanges) {
                  for (const change of txResult.objectChanges) {
                    if (
                      change.type === "created" &&
                      change.objectType.includes("::sui_mail::Mail")
                    ) {
                      createdMailId = change.objectId;
                      break;
                    }
                  }
                }

                if (!createdMailId) {
                  console.warn(
                    "Could not find created mail ID, but mail was sent"
                  );
                }

                resolve({ digest: result.digest, mailId: createdMailId });
              } catch (error) {
                console.error("Error getting mail ID:", error);
                resolve({ digest: result.digest, mailId: "" });
              }
            },
            onError: (error: any) => reject(error),
          }
        );
      }
    );
  }

  // Get mails for an allowlist
  async getMailsForAllowlist(allowlistId: string) {
    // Query MailSent events for this allowlist
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::sui_mail::MailSent`,
      },
    });

    const mails = [];
    for (const event of events.data) {
      if (
        event.parsedJson &&
        (event.parsedJson as any).allowlist_id === allowlistId
      ) {
        const mailId = (event.parsedJson as any).mail_id;
        const mailObject = await this.client.getObject({
          id: mailId,
          options: {
            showContent: true,
            showType: true,
          },
        });
        mails.push(mailObject);
      }
    }

    return mails;
  }

  // Get mail by ID
  async getMailById(mailId: string) {
    const mail = await this.client.getObject({
      id: mailId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    return mail;
  }

  // Add reply to mail (for adding reply content)
  async addReply(
    mailId: string,
    replyBlobId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::add_reply`,
      arguments: [tx.object(mailId), tx.pure.string(replyBlobId)],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Add reply relationship between two existing mails
  async addReplyRelationship(
    parentMailId: string,
    replyMailId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::add_reply_entry`,
      arguments: [
        tx.object(parentMailId), // Parent mail object
        tx.object(replyMailId), // Reply mail object
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Get all mails sent by user (across all allowlists they created)
  async getSentMails(userAddress: string) {
    // Query MailSent events where user is the sender
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::sui_mail::MailSent`,
      },
    });

    const mails = [];
    for (const event of events.data) {
      if (
        event.parsedJson &&
        (event.parsedJson as any).sender === userAddress
      ) {
        const mailId = (event.parsedJson as any).mail_id;
        try {
          const mailObject = await this.client.getObject({
            id: mailId,
            options: {
              showContent: true,
              showType: true,
            },
          });
          mails.push(mailObject);
        } catch (error) {
          console.error(`Failed to fetch mail ${mailId}:`, error);
        }
      }
    }

    return mails;
  }

  // Get all mails received by user (from allowlists they are members of, excluding sent mails)
  async getReceivedMails(userAddress: string) {
    console.log("🔍 Getting received mails for:", userAddress);
    const allMails: any[] = [];

    // Query MemberAdded events to find allowlists user is member of
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::sui_mail::MemberAdded`,
      },
    });

    // Filter events for this user and get unique allowlist IDs
    const allowlistIds = new Set<string>();
    for (const event of events.data) {
      if (
        event.parsedJson &&
        (event.parsedJson as any).member === userAddress
      ) {
        const allowlistId = (event.parsedJson as any).allowlist_id;
        allowlistIds.add(allowlistId);
      }
    }

    console.log("📝 Found allowlists:", allowlistIds.size);

    // Get mails from each allowlist
    for (const allowlistId of allowlistIds) {
      const mails = await this.getMailsForAllowlist(allowlistId);

      // Filter out mails sent by the current user
      const receivedMails = mails.filter(
        (mail) => mail.data?.content?.fields?.sender !== userAddress
      );
      allMails.push(...receivedMails);
    }

    console.log("📬 Total received mails:", allMails.length);
    return allMails;
  }

  // Get mail reply relationships (parent-child relationships)
  async getMailReplyRelationships(
    mailIds: string[]
  ): Promise<Map<string, string>> {
    const parentChildMap = new Map<string, string>();

    // Query MailReplied events
    const replyEvents = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::sui_mail::MailReplied`,
      },
    });

    // Build parent-child relationships for our mails
    for (const event of replyEvents.data) {
      if (event.parsedJson) {
        const replyData = event.parsedJson as any;
        const parentMailId = replyData.parent_mail_id;
        const replyMailId = replyData.reply_mail_id;

        // If the reply mail is in our list, store its parent
        if (mailIds.includes(replyMailId)) {
          parentChildMap.set(replyMailId, parentMailId);
        }
      }
    }

    return parentChildMap;
  }

  // Get all reply relationships for a user's mails
  async getMailThreadingForUser(
    userAddress: string
  ): Promise<Map<string, string>> {
    console.log("🔍 Getting mail threading for user:", userAddress);

    // First get all mail IDs for this user (both sent and received)
    const [sentMails, receivedMails] = await Promise.all([
      this.getSentMails(userAddress),
      this.getReceivedMails(userAddress),
    ]);

    console.log("📤 Sent mails count:", sentMails.length);
    console.log("📥 Received mails count:", receivedMails.length);

    // Extract all mail IDs
    const allMailIds = [
      ...sentMails.map((mail) => mail.data?.objectId).filter(Boolean),
      ...receivedMails.map((mail) => mail.data?.objectId).filter(Boolean),
    ];

    console.log("📋 All mail IDs to check for threading:", allMailIds);

    const relationships = this.getMailReplyRelationships(allMailIds);
    console.log("🔗 Final threading relationships:", relationships);

    return relationships;
  }

  // ===== TASK MANAGEMENT =====

  // Create task
  async createTask(
    blobId: string,
    assignee: string,
    deadline: number,
    startTime: number,
    allowlistId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    // Frontend validation
    if (!blobId.trim()) {
      throw new Error("Blob ID is required");
    }
    if (!assignee) {
      throw new Error("Assignee is required");
    }
    if (!allowlistId) {
      throw new Error("Allowlist ID is required");
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::create_task_entry`,
      arguments: [
        tx.pure.string(blobId), // blob_id: String
        tx.pure.address(assignee), // assignee: address
        tx.pure.u64(deadline), // deadline: u64
        tx.pure.u64(startTime), // start_time: u64
        tx.object(allowlistId), // &mut Allowlist
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Edit task
  async editTask(
    taskId: string,
    allowlistId: string,
    newBlobId: string,
    newAssignee: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::edit_task_entry`,
      arguments: [
        tx.object(taskId), // &mut Task
        tx.object(allowlistId), // &Allowlist
        tx.pure.string(newBlobId), // new_blob_id: String
        tx.pure.address(newAssignee), // new_assignee: address
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Update task status
  async updateTaskStatus(
    taskId: string,
    newStatus: number,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::update_task_status_entry`,
      arguments: [
        tx.object(taskId), // &mut Task
        tx.pure.u8(newStatus), // new_status: u8
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Delete task
  async deleteTask(
    taskId: string,
    allowlistId: string,
    signAndExecute: (input: {
      transaction: Transaction;
    }) => Promise<{ digest: string }>
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::sui_mail::delete_task_entry`,
      arguments: [
        tx.object(taskId), // &mut Task
        tx.object(allowlistId), // &mut Allowlist
      ],
    });

    return await signAndExecute({ transaction: tx });
  }

  // Get task details
  async getTask(taskId: string) {
    try {
      const taskObject = await this.client.getObject({
        id: taskId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (taskObject.data?.content?.dataType === "moveObject") {
        const fields = taskObject.data.content.fields;
        
        // Handle epoch numbers for created_at and updated_at
        // These are stored as epoch numbers from the blockchain, not millisecond timestamps
        // We'll convert them to approximate timestamps (Note: this is approximate since epochs vary in duration)
        const epochToTimestamp = (epoch: number) => {
          // More accurate epoch conversion based on current data
          // Current date: Nov 24, 2025 and current epoch: ~928
          // This gives us approximately 3.4 days per epoch
          const now = new Date();
          const currentEpoch = 928; // Approximate current epoch
          const epochOneTimestamp = new Date('2023-05-01T00:00:00Z').getTime(); // Sui mainnet launch
          const daysSinceEpochOne = (now.getTime() - epochOneTimestamp) / (24 * 60 * 60 * 1000);
          const epochDuration = daysSinceEpochOne / currentEpoch * 24 * 60 * 60 * 1000;
          
          if (epoch === 0) return 0;
          return epochOneTimestamp + (epoch - 1) * epochDuration;
        };
        
        return {
          id: taskId,
          creator: fields.creator,
          assignee: fields.assignee,
          blobId: fields.blob_id,
          status: fields.status,
          deleted: fields.deleted,
          deadline: parseInt(fields.deadline) || 0,
          startTime: parseInt(fields.start_time) || 0,
          allowlistId: fields.allowlist_id,
          createdAt: epochToTimestamp(parseInt(fields.created_at) || 0),
          updatedAt: epochToTimestamp(parseInt(fields.updated_at) || 0),
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching task:", error);
      return null;
    }
  }

  // Get tasks for allowlist
  async getTasksForAllowlist(allowlistId: string) {
    console.log("getTasksForAllowlist called for:", allowlistId);
    try {
      // Query TaskCreated events for this allowlist
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::sui_mail::TaskCreated`,
        },
        options: {
          showContent: true,
        },
      });

      console.log("All TaskCreated events:", events.data);

      // Filter events for this allowlist
      const taskEvents = events.data.filter(
        (event: any) => event.parsedJson?.allowlist_id === allowlistId
      );

      console.log("Filtered task events for allowlist:", taskEvents);

      // Get task objects
      const tasks = await Promise.all(
        taskEvents.map(async (event: any) => {
          const taskId = event.parsedJson?.task_id;
          console.log("Fetching task object for ID:", taskId);
          if (taskId) {
            return await this.getTask(taskId);
          }
          return null;
        })
      );

      const validTasks = tasks.filter((task) => task !== null && !task.deleted);
      console.log("Valid tasks returned:", validTasks);
      return validTasks;
    } catch (error) {
      console.error("Error fetching tasks for allowlist:", error);
      return [];
    }
  }

  // Get task blob ID
  getTaskBlobId(task: any): string {
    return task.blobId || task.blob_id;
  }

  // Get task assignee
  getTaskAssignee(task: any): string {
    return task.assignee;
  }

  // Get task status
  getTaskStatus(task: any): number {
    return task.status;
  }

  // Get task deadline
  getTaskDeadline(task: any): number {
    return task.deadline;
  }

  // Get task start time
  getTaskStartTime(task: any): number {
    return task.startTime || task.start_time;
  }

  // Get task creator
  getTaskCreator(task: any): string {
    return task.creator;
  }

  // Get task created at
  getTaskCreatedAt(task: any): number {
    return task.createdAt || task.created_at;
  }

  // Get task updated at
  getTaskUpdatedAt(task: any): number {
    return task.updatedAt || task.updated_at;
  }

  // Check if task is deleted
  isTaskDeleted(task: any): boolean {
    return task.deleted;
  }

  // Get members of an allowlist
  async getAllowlistMembers(allowlistId: string) {
    try {
      // Query MemberAdded events for this allowlist
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::sui_mail::MemberAdded`,
        },
        options: {
          showContent: true,
        },
      });

      // Find members added to this allowlist
      const members = events.data
        .filter((event: any) => event.parsedJson?.allowlist_id === allowlistId)
        .map((event: any) => event.parsedJson?.member);

      // Remove duplicates and filter valid
      const uniqueMembers = [...new Set(members)].filter((member) => member);

      console.log("Allowlist members:", uniqueMembers);
      return uniqueMembers;
    } catch (error) {
      console.error("Error fetching allowlist members:", error);
      return [];
    }
  }

  // Get projects where user is assigned tasks (for assignees)
  async getAssignedProjects(userAddress: string) {
    try {
      // Query MemberAdded events where the user was added as a member
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::sui_mail::MemberAdded`,
        },
        options: {
          showContent: true,
        },
      });

      // Get unique allowlist IDs where user is a member
      const memberAllowlistIds = new Set<string>();
      for (const event of events.data) {
        if (event.parsedJson?.member === userAddress) {
          memberAllowlistIds.add(event.parsedJson?.allowlist_id);
        }
      }

      // Fetch allowlist objects for these IDs
      const assignedProjects = await Promise.all(
        Array.from(memberAllowlistIds).map(async (allowlistId) => {
          try {
            const allowlistObject = await this.client.getObject({
              id: allowlistId,
              options: {
                showContent: true,
                showType: true,
              },
            });

            const content = allowlistObject.data?.content;
            if (content && content.dataType === "moveObject") {
              const fields = content.fields;

              // Skip mail allowlists (they have "Mail:" prefix in name)
              if (fields.name && fields.name.startsWith("Mail:")) {
                return null;
              }

              // Handle epoch numbers for timestamps
              const epochToTimestamp = (epoch: number) => {
                // More accurate epoch conversion based on current data
                // Current date: Nov 24, 2025 and current epoch: ~928
                // This gives us approximately 3.4 days per epoch
                const now = new Date();
                const currentEpoch = 928; // Approximate current epoch
                const epochOneTimestamp = new Date('2023-05-01T00:00:00Z').getTime(); // Sui mainnet launch
                const daysSinceEpochOne = (now.getTime() - epochOneTimestamp) / (24 * 60 * 60 * 1000);
                const epochDuration = daysSinceEpochOne / currentEpoch * 24 * 60 * 60 * 1000;
                
                if (epoch === 0) return 0;
                return epochOneTimestamp + (epoch - 1) * epochDuration;
              };
              
              return {
                id: allowlistId,
                name: fields.name,
                description: fields.description,
                owner: fields.owner,
                memberCount: parseInt(fields.member_count) || 0,
                taskCount: parseInt(fields.task_count) || 0,
                createdAt: epochToTimestamp(parseInt(fields.created_at) || 0),
                updatedAt: epochToTimestamp(parseInt(fields.updated_at) || 0),
              };
            }
          } catch (error) {
            console.error(
              `Error fetching assigned allowlist ${allowlistId}:`,
              error
            );
          }
          return null;
        })
      );

      return assignedProjects.filter((project) => project !== null);
    } catch (error) {
      console.error("Error fetching assigned projects:", error);
      return [];
    }
  }
}
