// Extract JSON content from multipart form-data response (copied from mailDecryptionService)
function extractJsonFromMultipart(text: string): string {
     if (text.includes("Content-Disposition: form-data")) {
          const lines = text.split("\n");
          let jsonStartIndex = -1;

          for (let i = 0; i < lines.length; i++) {
               if (
                    lines[i].includes("------WebKit") ||
                    lines[i].includes("Content-Disposition") ||
                    lines[i].includes("Content-Type")
               ) {
                    continue;
               }
               if (lines[i].trim() === "" && i < lines.length - 1) {
                    jsonStartIndex = i + 1;
                    break;
               }
          }

          if (jsonStartIndex !== -1) {
               const jsonContent = lines.slice(jsonStartIndex).join("\n");
               const cleanedJson = jsonContent
                    .split("\n")
                    .filter((line) => !line.startsWith("------"))
                    .join("\n")
                    .trim();
               return cleanedJson;
          }
     }
     return text;
}
import { useState, useCallback } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { SealEncryptionService } from "../services/sealService";
import { MailDecryptionService } from "../services/mailDecryptionService";
import { PACKAGE_ID } from "../config/constants";
import { fromHEX } from "@mysten/bcs";
import { base64ToUint8Array, uint8ArrayToBase64 } from "../utils/encryption";

export interface Task {
     id: string;
     creator: string;
     assignee: string;
     blobId: string;
     status: number;
     deleted: boolean;
     deadline: number;
     startTime: number;
     allowlistId: string;
     createdAt: number;
     updatedAt: number;
}

export interface TaskContent {
     title: string;
     description: string;
     deadline?: number;
     startTime?: number;
     attachments?: Array<{
          name: string;
          blobId: string;
          size: number;
     }>;
}

export const useTaskManagement = (
     suiService: SuiMailService,
     walrusService: WalrusService,
     sealService: SealEncryptionService,
     decryptionService?: MailDecryptionService,
) => {
     const [tasks, setTasks] = useState<Task[]>([]);
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);

     const account = useCurrentAccount();
     const { mutate: signAndExecute } = useSignAndExecuteTransaction();

     // Create task with encryption
     const createTask = useCallback(
          async (taskContent: TaskContent, assignee: string, allowlistId: string) => {
               if (!account) {
                    setError("No account connected");
                    return null;
               }

               setLoading(true);
               setError(null);

               try {
                    // Validate input
                    if (!taskContent.title.trim() || !taskContent.description.trim()) {
                         throw new Error("Title and description are required");
                    }

                    // Encrypt task content with envelope encryption (like mail)
                    const content = JSON.stringify({
                         title: taskContent.title,
                         description: taskContent.description,
                         deadline: taskContent.deadline,
                         startTime: taskContent.startTime,
                         attachments: taskContent.attachments || [],
                    });
                    const contentBytes = new TextEncoder().encode(content);
                    const { encryptedData, encryptedKey, backupKey } = await sealService.encryptLargeDataWithAllowlist(
                         contentBytes,
                         allowlistId,
                    );

                    // Wrap in EncryptedMailContent JSON (same as mail)
                    const encryptedTaskContent = {
                         encryptedData: uint8ArrayToBase64(encryptedData),
                         encryptedKey: uint8ArrayToBase64(encryptedKey),
                         backupKey: uint8ArrayToBase64(backupKey),
                         isEnvelopeEncrypted: true,
                    };
                    const encryptedJson = JSON.stringify(encryptedTaskContent);
                    // Store encrypted content as text on Walrus
                    const blobId = await walrusService.uploadText(encryptedJson);

                    // Create task on blockchain
                    const result = await new Promise<{ digest: string }>((resolve, reject) => {
                         signAndExecute(
                              {
                                   transaction: (() => {
                                        const tx = new Transaction();
                                        tx.moveCall({
                                             target: `${PACKAGE_ID}::sui_mail::create_task_entry`,
                                             arguments: [
                                                  tx.pure.string(blobId),
                                                  tx.pure.address(assignee),
                                                  tx.pure.u64(taskContent.deadline || 0),
                                                  tx.pure.u64(taskContent.startTime || 0),
                                                  tx.object(allowlistId),
                                             ],
                                        });
                                        return tx;
                                   })() as any,
                              },
                              {
                                   onSuccess: (result: any) => resolve({ digest: result.digest }),
                                   onError: (error: any) => reject(error),
                              },
                         );
                    });

                    return result;
               } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to create task";
                    setError(errorMessage);
                    throw err;
               } finally {
                    setLoading(false);
               }
          },
          [account, suiService, walrusService, signAndExecute],
     );

     // Edit task with encryption
     const editTask = useCallback(
          async (taskId: string, allowlistId: string, taskContent: TaskContent, newAssignee?: string) => {
               if (!account) {
                    setError("No account connected");
                    return null;
               }

               setLoading(true);
               setError(null);

               try {
                    // Validate input
                    if (!taskContent.title.trim() || !taskContent.description.trim()) {
                         throw new Error("Title and description are required");
                    }

                    // Get current task data to preserve deadline and startTime
                    const currentTask = await suiService.getTask(taskId);
                    if (!currentTask) {
                         throw new Error("Task not found");
                    }

                    // Encrypt new content with envelope encryption (like mail)
                    const newContent = JSON.stringify({
                         title: taskContent.title,
                         description: taskContent.description,
                         deadline: taskContent.deadline || currentTask.deadline, // Use new content or existing deadline
                         startTime: taskContent.startTime || currentTask.startTime, // Use new content or existing start time
                         attachments: taskContent.attachments || (currentTask as any).attachments || [], // Use new content or existing attachments
                    });
                    const newContentBytes = new TextEncoder().encode(newContent);
                    const { encryptedData, encryptedKey, backupKey } = await sealService.encryptLargeDataWithAllowlist(
                         newContentBytes,
                         allowlistId,
                    );

                    // Wrap in EncryptedMailContent JSON (same as mail)
                    const encryptedTaskContent = {
                         encryptedData: uint8ArrayToBase64(encryptedData),
                         encryptedKey: uint8ArrayToBase64(encryptedKey),
                         backupKey: uint8ArrayToBase64(backupKey),
                         isEnvelopeEncrypted: true,
                    };
                    const encryptedJson = JSON.stringify(encryptedTaskContent);
                    // Store encrypted content as text on Walrus
                    const newBlobId = await walrusService.uploadText(encryptedJson);

                    // Edit task on blockchain
                    const result = await new Promise<{ digest: string }>((resolve, reject) => {
                         signAndExecute(
                              {
                                   transaction: (() => {
                                        const tx = new Transaction();
                                        tx.moveCall({
                                             target: `${PACKAGE_ID}::sui_mail::edit_task_entry`,
                                             arguments: [
                                                  tx.object(taskId),
                                                  tx.object(allowlistId),
                                                  tx.pure.string(newBlobId),
                                                  tx.pure.address(newAssignee || currentTask.assignee),
                                             ],
                                        });
                                        return tx;
                                   })() as any,
                              },
                              {
                                   onSuccess: (result: any) => resolve({ digest: result.digest }),
                                   onError: (error: any) => reject(error),
                              },
                         );
                    });

                    return result;
               } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to edit task";
                    setError(errorMessage);
                    throw err;
               } finally {
                    setLoading(false);
               }
          },
          [account, suiService, walrusService, signAndExecute],
     );

     // Update task status
     const updateTaskStatus = useCallback(
          async (taskId: string, newStatus: number) => {
               if (!account) {
                    setError("No account connected");
                    return null;
               }

               setLoading(true);
               setError(null);

               try {
                    const result = await new Promise<{ digest: string }>((resolve, reject) => {
                         signAndExecute(
                              {
                                   transaction: (() => {
                                        const tx = new Transaction();
                                        tx.moveCall({
                                             target: `${PACKAGE_ID}::sui_mail::update_task_status_entry`,
                                             arguments: [tx.object(taskId), tx.pure.u8(newStatus)],
                                        });
                                        return tx;
                                   })() as any,
                              },
                              {
                                   onSuccess: (result: any) => resolve({ digest: result.digest }),
                                   onError: (error: any) => reject(error),
                              },
                         );
                    });
                    return result;
               } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to update task status";
                    setError(errorMessage);
                    throw err;
               } finally {
                    setLoading(false);
               }
          },
          [account, suiService, signAndExecute],
     );

     // Delete task
     const deleteTask = useCallback(
          async (taskId: string, allowlistId: string) => {
               if (!account) {
                    setError("No account connected");
                    return null;
               }

               setLoading(true);
               setError(null);

               try {
                    const result = await new Promise<{ digest: string }>((resolve, reject) => {
                         signAndExecute(
                              {
                                   transaction: (() => {
                                        const tx = new Transaction();
                                        tx.moveCall({
                                             target: `${PACKAGE_ID}::sui_mail::delete_task_entry`,
                                             arguments: [tx.object(taskId), tx.object(allowlistId)],
                                        });
                                        return tx;
                                   })() as any,
                              },
                              {
                                   onSuccess: (result: any) => resolve({ digest: result.digest }),
                                   onError: (error: any) => reject(error),
                              },
                         );
                    });
                    return result;
               } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to delete task";
                    setError(errorMessage);
                    throw err;
               } finally {
                    setLoading(false);
               }
          },
          [account, suiService, signAndExecute],
     );

     // Load tasks for allowlist
     const loadTasks = useCallback(
          async (allowlistId: string) => {
               console.log("Hook loadTasks called for allowlist:", allowlistId);
               setLoading(true);
               setError(null);

               try {
                    const blockchainTasks = await suiService.getTasksForAllowlist(allowlistId);
                    console.log("Blockchain tasks loaded:", blockchainTasks);

                    // Decrypt task contents using proper Seal decryption for tasks
                    const decryptedTasks = await Promise.all(
                         blockchainTasks.map(async (task) => {
                              try {
                                   if (decryptionService) {
                                        console.log("Attempting to decrypt task:", task.id);

                                        // Download and extract JSON from multipart (like mail)
                                        const multipartText = await walrusService.downloadBlobAsText(task.blobId);
                                        console.log(
                                             "Downloaded multipart text, first 100 chars:",
                                             multipartText.substring(0, 100),
                                        );

                                        // Robustly extract JSON from multipart (like mail)
                                        const jsonContent = extractJsonFromMultipart(multipartText);
                                        // Parse as EncryptedMailContent
                                        const encryptedTaskContent = JSON.parse(jsonContent);
                                        if (!encryptedTaskContent.isEnvelopeEncrypted) {
                                             throw new Error("Non-envelope encrypted tasks not supported");
                                        }

                                        // Decode base64 fields
                                        const encryptedData = base64ToUint8Array(encryptedTaskContent.encryptedData);
                                        const encryptedKey = base64ToUint8Array(
                                             encryptedTaskContent.encryptedKey || "",
                                        );

                                        // Create transaction for seal_approve
                                        const tx = new Transaction();
                                        tx.moveCall({
                                             target: `${PACKAGE_ID}::sui_mail::seal_approve`,
                                             arguments: [
                                                  tx.pure.vector("u8", fromHEX(allowlistId.replace("0x", ""))),
                                                  tx.object(allowlistId),
                                             ],
                                        });

                                        const txBytes = await tx.build({
                                             client: (suiService as any).client,
                                             onlyTransactionKind: true,
                                        });
                                        console.log("Built transaction bytes length:", txBytes.length);

                                        // Get session key from decryption service
                                        const sessionKey = decryptionService.getSessionKey();
                                        console.log("Session key available:", !!sessionKey);
                                        if (!sessionKey) {
                                             throw new Error("Session key not available for task decryption");
                                        }

                                        // Decrypt the envelope (like mail)
                                        console.log("Starting envelope decryption for task...");
                                        try {
                                             const decryptedData = await sealService.decryptLargeData(
                                                  encryptedData,
                                                  encryptedKey,
                                                  sessionKey,
                                                  txBytes,
                                             );
                                             console.log(
                                                  "Decryption successful, decrypted data length:",
                                                  decryptedData.length,
                                             );

                                             // Parse the decrypted JSON
                                             const taskJson = new TextDecoder().decode(decryptedData);
                                             console.log("Decrypted JSON:", taskJson);
                                             const taskContent = JSON.parse(taskJson);

                                             return {
                                                  ...task,
                                                  title: taskContent.title || "No Title",
                                                  description: taskContent.description || "No Description",
                                                  // Use decrypted values if available, otherwise use blockchain values
                                                  // Ensure deadline and startTime are numbers (not strings)
                                                  deadline: taskContent.deadline
                                                       ? Number(taskContent.deadline)
                                                       : task.deadline,
                                                  startTime: taskContent.startTime
                                                       ? Number(taskContent.startTime)
                                                       : task.startTime,
                                                  attachments: taskContent.attachments || task.attachments || [],
                                             };
                                        } catch (err) {
                                             console.error("❌ Envelope decryption failed for task", task.id, err);
                                             throw err;
                                        }
                                   } else {
                                        console.log("No decryption service available, using placeholder");
                                        // Fallback to placeholder
                                        return {
                                             ...task,
                                             title: "Task Title (Encrypted)",
                                             description: "Task description (requires decryption setup)",
                                        };
                                   }
                              } catch (decryptError) {
                                   console.error("Failed to decrypt task:", task.id, decryptError);
                                   return {
                                        ...task,
                                        title: "Decryption Failed",
                                        description: "Unable to decrypt task content",
                                   };
                              }
                         }),
                    );

                    console.log("Decrypted tasks:", decryptedTasks);

                    // Make task data available to AI assistant
                    if (typeof window !== "undefined") {
                        (window as any).tasksData = decryptedTasks;
                    }

                    setTasks(decryptedTasks);
                    return decryptedTasks;
               } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Failed to load tasks";
                    setError(errorMessage);
                    throw err;
               } finally {
                    setLoading(false);
               }
          },
          [suiService, walrusService],
     );

     // Get single task with decrypted content
     const getTaskWithContent = useCallback(
          async (taskId: string) => {
               try {
                    const task = await suiService.getTask(taskId);
                    if (!task) return null;

                    try {
                         // Full decryption requires Seal session key initialization and txBytes
                         return {
                              ...task,
                              title: "Encrypted Task", // Placeholder
                              description: "Content requires decryption", // Placeholder
                         };
                    } catch (decryptError) {
                         console.error("Failed to decrypt task:", taskId, decryptError);
                         return {
                              ...task,
                              title: "Unable to decrypt",
                              description: "Content unavailable",
                         };
                    }
               } catch (err) {
                    console.error("Failed to get task:", err);
                    return null;
               }
          },
          [suiService],
     );

     return {
          tasks,
          loading,
          error,
          createTask,
          editTask,
          updateTaskStatus,
          deleteTask,
          loadTasks,
          getTaskWithContent,
          clearError: () => setError(null),
     };
};
