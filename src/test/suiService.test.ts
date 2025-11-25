import { describe, it, expect, vi, beforeEach } from "vitest";
import { SuiMailService } from "../services/suiService";
import { Transaction } from "@mysten/sui/transactions";

// Mock Sui client
const mockClient = {
  getObject: vi.fn(),
  queryEvents: vi.fn(),
  call: vi.fn(),
};

const mockSignAndExecute = vi.fn();

describe("SuiMailService", () => {
  let service: SuiMailService;

  beforeEach(() => {
    service = new SuiMailService(mockClient as any);
    vi.clearAllMocks();
  });

  describe("Task Management", () => {
    const mockTaskId = "0x123";
    const mockAllowlistId = "0x456";
    const mockBlobId = "blob_123";
    const mockAssignee = "0x789";
    const mockDeadline = 1000000;
    const mockStartTime = 500000;

    describe("createTask", () => {
      it("should create task transaction with correct parameters", async () => {
        mockSignAndExecute.mockResolvedValue({ digest: "tx_digest" });

        const result = await service.createTask(
          mockBlobId,
          mockAssignee,
          mockDeadline,
          mockStartTime,
          mockAllowlistId,
          mockSignAndExecute
        );

        expect(mockSignAndExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.any(Transaction),
          })
        );
        expect(result).toEqual({ digest: "tx_digest" });
      });

      it("should validate blob_id is not empty", async () => {
        await expect(
          service.createTask(
            "",
            mockAssignee,
            mockDeadline,
            mockStartTime,
            mockAllowlistId,
            mockSignAndExecute
          )
        ).rejects.toThrow();
      });
    });

    describe("editTask", () => {
      it("should edit task transaction with correct parameters", async () => {
        mockSignAndExecute.mockResolvedValue({ digest: "edit_digest" });

        const result = await service.editTask(
          mockTaskId,
          mockAllowlistId,
          mockBlobId,
          mockAssignee,
          mockSignAndExecute
        );

        expect(mockSignAndExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.any(Transaction),
          })
        );
        expect(result).toEqual({ digest: "edit_digest" });
      });
    });

    describe("updateTaskStatus", () => {
      it("should update task status with valid status", async () => {
        mockSignAndExecute.mockResolvedValue({ digest: "status_digest" });

        const result = await service.updateTaskStatus(
          mockTaskId,
          1,
          mockSignAndExecute
        ); // IN_PROGRESS

        expect(mockSignAndExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.any(Transaction),
          })
        );
        expect(result).toEqual({ digest: "status_digest" });
      });
    });

    describe("deleteTask", () => {
      it("should delete task transaction", async () => {
        mockSignAndExecute.mockResolvedValue({ digest: "delete_digest" });

        const result = await service.deleteTask(
          mockTaskId,
          mockAllowlistId,
          mockSignAndExecute
        );

        expect(mockSignAndExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: expect.any(Transaction),
          })
        );
        expect(result).toEqual({ digest: "delete_digest" });
      });
    });

    describe("getTask", () => {
      it("should return parsed task data", async () => {
        const mockTaskObject = {
          data: {
            content: {
              dataType: "moveObject",
              fields: {
                creator: "0x111",
                assignee: "0x222",
                blob_id: "blob_123",
                status: 0,
                deleted: false,
                deadline: 1000000,
                start_time: 500000,
                allowlist_id: "0x456",
                created_at: 123456,
                updated_at: 123457,
              },
            },
          },
        };

        mockClient.getObject.mockResolvedValue(mockTaskObject);

        const result = await service.getTask(mockTaskId);

        expect(result).toEqual({
          id: mockTaskId,
          creator: "0x111",
          assignee: "0x222",
          blobId: "blob_123",
          status: 0,
          deleted: false,
          deadline: 1000000,
          startTime: 500000,
          allowlistId: "0x456",
          createdAt: 123456,
          updatedAt: 123457,
        });
      });

      it("should return null for invalid object", async () => {
        mockClient.getObject.mockResolvedValue({ data: null });

        const result = await service.getTask(mockTaskId);

        expect(result).toBeNull();
      });
    });

    describe("getTasksForAllowlist", () => {
      it("should return tasks for allowlist", async () => {
        const mockEvents = {
          data: [
            {
              parsedJson: {
                task_id: "0x123",
                allowlist_id: mockAllowlistId,
              },
            },
          ],
        };

        const mockTask = {
          id: "0x123",
          creator: "0x111",
          deleted: false,
        };

        mockClient.queryEvents.mockResolvedValue(mockEvents);
        vi.spyOn(service, "getTask").mockResolvedValue(mockTask as any);

        const result = await service.getTasksForAllowlist(mockAllowlistId);

        expect(result).toEqual([mockTask]);
        expect(service.getTask).toHaveBeenCalledWith("0x123");
      });

      it("should filter out deleted tasks", async () => {
        const mockEvents = {
          data: [
            {
              parsedJson: {
                task_id: "0x123",
                allowlist_id: mockAllowlistId,
              },
            },
          ],
        };

        const mockTask = {
          id: "0x123",
          creator: "0x111",
          deleted: true, // deleted task
        };

        mockClient.queryEvents.mockResolvedValue(mockEvents);
        vi.spyOn(service, "getTask").mockResolvedValue(mockTask as any);

        const result = await service.getTasksForAllowlist(mockAllowlistId);

        expect(result).toEqual([]); // filtered out
      });
    });

    describe("Task getters", () => {
      const mockTask = {
        blobId: "blob_123",
        assignee: "0x789",
        status: 1,
        deadline: 1000000,
        startTime: 500000,
        creator: "0x111",
        createdAt: 123456,
        updatedAt: 123457,
        deleted: false,
      };

      it("should get task blob id", () => {
        expect(service.getTaskBlobId(mockTask)).toBe("blob_123");
      });

      it("should get task assignee", () => {
        expect(service.getTaskAssignee(mockTask)).toBe("0x789");
      });

      it("should get task status", () => {
        expect(service.getTaskStatus(mockTask)).toBe(1);
      });

      it("should get task deadline", () => {
        expect(service.getTaskDeadline(mockTask)).toBe(1000000);
      });

      it("should get task start time", () => {
        expect(service.getTaskStartTime(mockTask)).toBe(500000);
      });

      it("should get task creator", () => {
        expect(service.getTaskCreator(mockTask)).toBe("0x111");
      });

      it("should get task created at", () => {
        expect(service.getTaskCreatedAt(mockTask)).toBe(123456);
      });

      it("should get task updated at", () => {
        expect(service.getTaskUpdatedAt(mockTask)).toBe(123457);
      });

      it("should check if task is deleted", () => {
        expect(service.isTaskDeleted(mockTask)).toBe(false);
      });
    });
  });
});
