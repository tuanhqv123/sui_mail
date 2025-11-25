import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  CheckSquare,
  Clock,
  AlertCircle,
  Users,
  ArrowLeft,
  Trash2,
  Calendar,
  User,
  X,
  Save,
  FolderOpen,
  Folder,
  Eye,
  Paperclip,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { SuiMailService } from "../services/suiService";
import { WalrusService } from "../services/walrusService";
import { SealEncryptionService } from "../services/sealService";
import { MailDecryptionService } from "../services/mailDecryptionService";
import { formatFileSize } from "../utils/encryption";
import { useTaskManagement } from "../hooks/useTaskManagement";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "../config/constants";
import Button from "../components/Button";
import ErrorModal from "../components/ErrorModal";

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TaskErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("TaskErrorBoundary caught an error:", error, errorInfo);
    this.setState({ hasError: true, error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-700 mb-4">
              An error occurred while loading the task management interface.
              Please try refreshing the page.
            </p>
            <details className="bg-gray-100 p-4 rounded">
              <summary className="cursor-pointer font-medium text-gray-800">
                Error Details
              </summary>
              <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                {this.state.error && this.state.error.toString()}
              </pre>
            </details>
            <button
              onClick={() =>
                this.setState({
                  hasError: false,
                  error: null,
                })
              }
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  memberCount: number;
  taskCount: number;
  createdAt: number;
  updatedAt: number;
}

interface Task {
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
  title?: string;
  description?: string;
  attachments?: Array<{
    name: string;
    blobId: string;
    size: number;
  }>;
}

interface TaskFormData {
  title: string;
  description: string;
  assignee: string;
  deadline: string;
  startTime: string;
  attachments: File[];
  status?: number;
}

interface ProjectFormData {
  name: string;
  description: string;
  members: string[];
}

const Tasks = () => {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const [suiService] = useState(() => new SuiMailService(suiClient));
  const [walrusService] = useState(() => new WalrusService());
  const [sealService] = useState(() => SealEncryptionService.getInstance({}));
  const [decryptionService] = useState(() =>
    MailDecryptionService.getInstance(suiClient)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tasks,
    loading,
    error,
    createTask,
    editTask,
    updateTaskStatus,
    deleteTask,
    loadTasks,
  } = useTaskManagement(
    suiService,
    walrusService,
    sealService,
    decryptionService
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectMembers, setProjectMembers] = useState<string[]>([]);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<"all" | "todo" | "inProgress" | "done">(
    "all"
  );
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Form state
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    assignee: "",
    deadline: "",
    startTime: "",
    attachments: [],
  });

  // State to track if form data has changed
  const [hasFormChanged, setHasFormChanged] = useState(false);
  const [originalTaskData, setOriginalTaskData] = useState<Task | null>(null);

  // Error/Success Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isError: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isError: false,
  });

  const [memberInput, setMemberInput] = useState("");

  // File input ref for task attachments
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // Helper functions for showing modals
  const showError = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      title,
      message,
      isError: true,
    });
  };

  const showSuccess = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      title,
      message,
      isError: false,
    });
  };

  // Helper function to check if current user can edit task content
  const canEditTaskContent = (task: Task | null) => {
    if (!account || !selectedProject || !task) return false;
    const currentAddress = account.address;
    return (
      task.creator === currentAddress ||
      selectedProject.owner === currentAddress
    );
  };

  // Helper function to check if current user can change task status
  const canChangeTaskStatus = (task: Task | null) => {
    if (!account || !task) return false;
    const currentAddress = account.address;
    // update_task_status: task.creator OR task.assignee can change status
    return task.creator === currentAddress || task.assignee === currentAddress;
  };

  // Helper function to check if current user can delete task
  const canDeleteTask = (task: Task | null) => {
    // delete follows same rules as edit_task (creator or owner)
    return canEditTaskContent(task);
  };

  // Project form state
  const [projectFormData, setProjectFormData] = useState<ProjectFormData>({
    name: "",
    description: "",
    members: [],
  });

  // Load user's projects (allowlists)
  useEffect(() => {
    if (account && suiService) {
      loadUserProjects();
    }
  }, [account, suiService]);

  // Load ALL tasks in background for AI context when projects are loaded
  useEffect(() => {
    if (account) {
      const loadAllTasksForAI = async () => {
        console.log("🔄 Loading all tasks in background for AI context...");
        try {
          let allTasks: any[] = [];

          if (projects.length > 0) {
            // Load tasks from all projects in parallel
            const allTasksPromises = projects.map((project) =>
              loadTasks(project.id).catch((error) => {
                console.error(
                  `Failed to load tasks for project ${project.id}:`,
                  error
                );
                return [];
              })
            );

            const allTasksArrays = await Promise.all(allTasksPromises);
            allTasks = allTasksArrays.flat();
          } else {
            // No projects found, ensure empty array is available to AI
            console.log(
              "ℹ️ No projects found, setting empty task array for AI"
            );
          }

          console.log(
            `✅ Loaded ${allTasks.length} total tasks in background for AI`
          );

          // Make all tasks available to AI assistant
          if (typeof window !== "undefined") {
            (window as any).tasksData = allTasks;
          }
        } catch (error) {
          console.error("Failed to load all tasks for AI:", error);
          // Ensure empty array on error
          if (typeof window !== "undefined") {
            (window as any).tasksData = [];
          }
        }
      };

      loadAllTasksForAI();
    }
  }, [projects, account]);

  // Load tasks when project is selected
  useEffect(() => {
    if (selectedProject) {
      const loadProjectData = async () => {
        setIsLoadingTasks(true);
        try {
          const loadedTasks = await loadTasks(selectedProject.id);
          // Set project tasks directly from the loaded tasks
          const tasksForProject = loadedTasks.filter(
            (task) => task.allowlistId === selectedProject.id
          );
          setProjectTasks(tasksForProject);
        } catch (error) {
          console.error("Failed to load project data:", error);
        } finally {
          setIsLoadingTasks(false);
        }
      };
      loadProjectData();
      loadProjectMembers(selectedProject.id);
    }
  }, [selectedProject]);

  const loadProjectMembers = async (projectId: string) => {
    if (!suiService) return;

    try {
      const members = await suiService.getAllowlistMembers(projectId);
      setProjectMembers(members as string[]);
    } catch (error) {
      console.error("Failed to load project members:", error);
      setProjectMembers([]);
    }
  };

  const loadUserProjects = async () => {
    if (!account?.address || !suiService) return;

    setIsLoadingProjects(true);

    try {
      // Load projects where user is owner (has Cap objects)
      const capObjects = await suiService.getUserCapObjects(account.address);
      console.log("Cap objects:", capObjects);

      const ownedProjects: Project[] = await Promise.all(
        capObjects.map(async (capObj: any) => {
          const capFields = capObj.data?.content?.fields;
          const allowlistId = capFields?.allowlist_id;
          console.log("Cap fields:", capFields, "Allowlist ID:", allowlistId);

          if (allowlistId) {
            try {
              const allowlistObject = await suiClient.getObject({
                id: allowlistId,
                options: {
                  showContent: true,
                  showType: true,
                },
              });
              console.log("Fetched allowlist object:", allowlistObject);

              const content = allowlistObject.data?.content;
              if (content && content.dataType === "moveObject") {
                const fields = content.fields as {
                  name?: string;
                  description?: string;
                  owner?: string;
                  member_count?: string;
                  task_count?: string;
                  created_at?: string;
                  updated_at?: string;
                };
                console.log("Allowlist fields:", fields);

                // Skip mail allowlists (they have "Mail:" prefix in name)
                if (fields.name && fields.name.startsWith("Mail:")) {
                  console.log("Skipping mail allowlist:", fields.name);
                  return null;
                }

                // Handle epoch numbers for timestamps
                const epochToTimestamp = (epoch: number) => {
                  // More accurate epoch conversion based on current data
                  // Current date: Nov 24, 2025 and current epoch: ~928
                  // This gives us approximately 3.4 days per epoch
                  const now = new Date();
                  const currentEpoch = 928; // Approximate current epoch
                  const epochOneTimestamp = new Date(
                    "2023-05-01T00:00:00Z"
                  ).getTime(); // Sui mainnet launch
                  const daysSinceEpochOne =
                    (now.getTime() - epochOneTimestamp) / (24 * 60 * 60 * 1000);
                  const epochDuration =
                    (daysSinceEpochOne / currentEpoch) * 24 * 60 * 60 * 1000;

                  if (epoch === 0) return 0;
                  return epochOneTimestamp + (epoch - 1) * epochDuration;
                };

                return {
                  id: allowlistId,
                  name: fields.name || "",
                  description: fields.description || "",
                  owner: fields.owner || "",
                  memberCount: parseInt(fields.member_count || "0") || 0,
                  taskCount: parseInt(fields.task_count || "0") || 0,
                  createdAt: epochToTimestamp(
                    parseInt(fields.created_at || "0") || 0
                  ),
                  updatedAt: epochToTimestamp(
                    parseInt(fields.updated_at || "0") || 0
                  ),
                };
              }
            } catch (error) {
              console.error(`Error fetching allowlist ${allowlistId}:`, error);
            }
          }
          return null;
        })
      );

      // Load projects where user is assigned tasks
      const assignedProjects = await suiService.getAssignedProjects(
        account.address
      );
      console.log("Assigned projects:", assignedProjects);

      // Combine owned and assigned projects, removing duplicates
      const allProjects = [
        ...(ownedProjects.filter((p) => p !== null) as Project[]),
        ...assignedProjects,
      ];
      const uniqueProjects = allProjects.filter(
        (project, index, self) =>
          index === self.findIndex((p) => p.id === project.id)
      );

      // Make allowlist data available to AI assistant
      if (typeof window !== "undefined") {
        (window as any).allowlistsData = uniqueProjects || [];
      }

      console.log("All unique projects:", uniqueProjects);
      setProjects(uniqueProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const filteredTasks = projectTasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "todo") return task.status === 0;
    if (filter === "inProgress") return task.status === 1;
    if (filter === "done") return task.status === 2;
    return true;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return null;

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "Invalid date";

      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const downloadAttachment = async (attachment: any) => {
    try {
      const data = await walrusService.downloadBlob(attachment.blobId);
      const blob = new Blob([data as BlobPart], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      showError(
        "Download Failed",
        "Failed to download attachment. Please try again."
      );
    }
  };

  const handleCreateProject = async () => {
    if (!projectFormData.name.trim()) {
      showError("Validation Error", "Please enter a project name");
      return;
    }

    setIsCreatingProject(true);

    try {
      const tx = new Transaction();

      // Create allowlist
      tx.moveCall({
        target: `${PACKAGE_ID}::sui_mail::create_allowlist_entry`,
        arguments: [
          tx.pure.string(projectFormData.name),
          tx.pure.string(projectFormData.description),
        ],
      });

      // Sign and execute transaction
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: async (result) => {
            console.log("Project created successfully:", result);

            // Parse the result to get allowlist and cap IDs
            try {
              await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for indexing
              const txResult = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: {
                  showObjectChanges: true,
                },
              });

              const allowlistChange = txResult.objectChanges?.find(
                (change: any) =>
                  change.type === "created" &&
                  change.objectType?.includes("::sui_mail::Allowlist")
              );

              const capChange = txResult.objectChanges?.find(
                (change: any) =>
                  change.type === "created" &&
                  change.objectType?.includes("::sui_mail::Cap")
              );

              if (
                allowlistChange &&
                capChange &&
                "objectId" in allowlistChange &&
                "objectId" in capChange
              ) {
                const allowlistId = allowlistChange.objectId;
                const capId = capChange.objectId;

                // Add to local state
                const newProject: Project = {
                  id: allowlistId,
                  name: projectFormData.name,
                  description: projectFormData.description,
                  owner: account?.address || "",
                  memberCount: 1, // Owner only initially
                  taskCount: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };

                setProjects((prev) => [...prev, newProject]);
                setShowCreateProject(false);
                resetProjectForm();

                // Auto-add members if any
                if (projectFormData.members.length > 0) {
                  await handleAddMembersAfterCreation(
                    allowlistId,
                    capId,
                    projectFormData.members
                  );
                }
              } else {
                throw new Error(
                  "Allowlist or Cap not found in transaction result"
                );
              }
            } catch (parseError) {
              console.error("Failed to parse transaction result:", parseError);
              showError(
                "Parse Error",
                "Project created but failed to parse result. Please refresh and add members manually."
              );
            }
          },
          onError: (error) => {
            console.error("Failed to create project:", error);
            showError(
              "Project Creation Failed",
              "Failed to create project. Please try again."
            );
          },
        }
      );
    } catch (error) {
      console.error("Failed to create project:", error);
      showError(
        "Project Creation Failed",
        "Failed to create project. Please try again."
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleAddMembersAfterCreation = async (
    allowlistId: string,
    capId: string,
    members: string[]
  ) => {
    try {
      const tx = new Transaction();

      for (const memberAddr of members) {
        if (memberAddr.trim()) {
          tx.moveCall({
            target: `${PACKAGE_ID}::sui_mail::add_member_by_address_entry`,
            arguments: [
              tx.object(allowlistId), // Reference to existing allowlist
              tx.object(capId), // Reference to existing cap
              tx.pure.address(memberAddr.trim()),
            ],
          });
        }
      }

      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            console.log("Members added successfully:", result);
            // Reload projects to get updated member count
            loadUserProjects();
            // Reload members for current project
            if (selectedProject) {
              loadProjectMembers(selectedProject.id);
            }
            showSuccess("Success", "Project and members created successfully!");
          },
          onError: (error) => {
            console.error("Failed to add members:", error);
            showError(
              "Warning",
              "Project created but failed to add members. You can add them manually later."
            );
          },
        }
      );
    } catch (error) {
      console.error("Failed to add members:", error);
      showError(
        "Warning",
        "Project created but failed to add members. You can add them manually later."
      );
    }
  };

  const handleCreateTask = async () => {
    if (
      !selectedProject ||
      !taskFormData.title ||
      !taskFormData.assignee ||
      !taskFormData.deadline
    ) {
      showError("Validation Error", "Please fill in all required fields");
      return;
    }

    if (!projectMembers.includes(taskFormData.assignee)) {
      showError(
        "Validation Error",
        "Selected assignee is not a member of this project"
      );
      return;
    }

    // Check if current user (creator) is a member of the project
    if (!projectMembers.includes(account?.address || "")) {
      showError(
        "Permission Error",
        "You must be a member of this project to create tasks"
      );
      return;
    }

    // Validate time constraints
    const deadlineTimestamp = new Date(taskFormData.deadline).getTime();
    const startTimeTimestamp = taskFormData.startTime
      ? new Date(taskFormData.startTime).getTime()
      : 0;

    if (startTimeTimestamp > 0 && deadlineTimestamp > 0) {
      if (startTimeTimestamp >= deadlineTimestamp) {
        showError("Validation Error", "Start time must be before deadline");
        return;
      }
    }

    setIsCreatingTask(true);

    try {
      // Use timestamps already calculated above

      // Upload attachments if any
      let attachmentBlobIds: string[] = [];
      if (taskFormData.attachments && taskFormData.attachments.length > 0) {
        console.log("Uploading attachments:", taskFormData.attachments);
        attachmentBlobIds = await Promise.all(
          taskFormData.attachments.map((file) => walrusService.uploadFile(file))
        );
      }

      // Create task content with attachment references
      const taskContent = {
        title: taskFormData.title,
        description: taskFormData.description,
        deadline: deadlineTimestamp,
        startTime: startTimeTimestamp,
        attachments: attachmentBlobIds.map((blobId, index) => ({
          name: taskFormData.attachments[index].name,
          blobId: blobId,
          size: taskFormData.attachments[index].size,
        })),
      };

      console.log("Creating task with:", {
        title: taskContent.title,
        assignee: taskFormData.assignee,
        deadline: deadlineTimestamp,
        startTime: startTimeTimestamp,
        attachmentsCount: attachmentBlobIds.length,
        allowlistId: selectedProject.id,
      });

      await createTask(taskContent, taskFormData.assignee, selectedProject.id);

      setShowCreateTask(false);
      resetTaskForm();
      // Reload tasks for the current project to show new task in kanban
      if (selectedProject) {
        setTimeout(async () => {
          try {
            const updatedTasks = await loadTasks(selectedProject.id);
            const tasksForProject = updatedTasks.filter(
              (task) => task.allowlistId === selectedProject.id
            );
            setProjectTasks(tasksForProject);
          } catch (error) {
            console.error("Failed to reload tasks after creation:", error);
          }
        }, 1000);
      }
      showSuccess("Success", "Task created successfully!");
    } catch (error) {
      console.error("Failed to create task:", error);
      showError(
        "Task Creation Failed",
        "Failed to create task. Please try again."
      );
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: number) => {
    try {
      // Then update on blockchain
      await updateTaskStatus(taskId, newStatus);

      // Show success message
      showSuccess("Status Updated", "Task status updated successfully!");

      // Reload tasks for the current project to ensure consistency
      if (selectedProject) {
        setTimeout(async () => {
          try {
            const updatedTasks = await loadTasks(selectedProject.id);
            // Update local state with fresh data
            const tasksForProject = updatedTasks.filter(
              (task) => task.allowlistId === selectedProject.id
            );
            setProjectTasks(tasksForProject);
          } catch (error) {
            console.error("Failed to reload tasks after status update:", error);
          }
        }, 1000); // Delay to allow blockchain to update
      }
    } catch (error) {
      console.error("Failed to update task status:", error);
      showError(
        "Status Update Failed",
        "Failed to update task status. Please try again."
      );
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (
      !selectedProject ||
      !confirm("Are you sure you want to delete this task?")
    )
      return;

    try {
      await deleteTask(taskId, selectedProject.id);

      // Show success message
      showSuccess("Task Deleted", "Task deleted successfully!");

      // Reload tasks for the current project
      setTimeout(async () => {
        try {
          const updatedTasks = await loadTasks(selectedProject.id);
          const tasksForProject = updatedTasks.filter(
            (task) => task.allowlistId === selectedProject.id
          );
          setProjectTasks(tasksForProject);
        } catch (error) {
          console.error("Failed to reload tasks after deletion:", error);
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to delete task:", error);
      showError(
        "Task Deletion Failed",
        "Failed to delete task. Please try again."
      );
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      title: "",
      description: "",
      assignee: "",
      deadline: "",
      startTime: "",
      attachments: [],
      status: 0,
    });
    setOriginalTaskData(null);
    setHasFormChanged(false);
  };

  const handleEditTask = async (task: Task) => {
    if (!selectedProject) return;

    try {
      // Use the task data that's already loaded and decrypted
      // The task parameter already contains the decrypted data from loadTasks
      const formData = {
        title: task.title || "",
        description: task.description || "",
        assignee: task.assignee || "",
        deadline: task.deadline
          ? new Date(task.deadline).toISOString().slice(0, 16)
          : "",
        startTime: task.startTime
          ? new Date(task.startTime).toISOString().slice(0, 16)
          : "",
        attachments: [], // Reset attachments for editing
        status: task.status || 0,
      };

      setTaskFormData(formData);
      setOriginalTaskData(task);
      setEditingTask(task);
      setHasFormChanged(false);
    } catch (error) {
      console.error("Failed to load task for editing:", error);
      showError("Loading Error", "Failed to load task details for editing");
    }
  };

  const handleSaveEditTask = async () => {
    if (!editingTask || !selectedProject || !account) return;

    if (
      !taskFormData.title ||
      !taskFormData.assignee ||
      !taskFormData.deadline
    ) {
      showError("Validation Error", "Please fill in all required fields");
      return;
    }

    setIsSavingTask(true);

    try {
      const currentAddress = account.address;
      const isCreatorOrOwner =
        editingTask.creator === currentAddress ||
        selectedProject.owner === currentAddress;

      // Check what has changed
      const hasTitleChanged = taskFormData.title !== (editingTask.title || "");
      const hasDescriptionChanged =
        taskFormData.description !== (editingTask.description || "");
      const hasAssigneeChanged = taskFormData.assignee !== editingTask.assignee;

      // Compare dates properly - form stores as ISO string, task stores as timestamp
      const formattedTaskDeadline = editingTask.deadline
        ? new Date(editingTask.deadline).toISOString().slice(0, 16)
        : "";
      const formattedTaskStartTime = editingTask.startTime
        ? new Date(editingTask.startTime).toISOString().slice(0, 16)
        : "";

      const hasDeadlineChanged =
        taskFormData.deadline !== formattedTaskDeadline;
      const hasStartTimeChanged =
        taskFormData.startTime !== formattedTaskStartTime;
      const hasNewAttachments = taskFormData.attachments.length > 0;

      // Content changes = fields that only creator/owner can edit
      const contentChanged =
        hasTitleChanged ||
        hasDescriptionChanged ||
        hasAssigneeChanged ||
        hasDeadlineChanged ||
        hasStartTimeChanged ||
        hasNewAttachments;

      const statusChanged =
        taskFormData.status !== undefined &&
        taskFormData.status !== editingTask.status;

      // Handle content changes (only if creator/owner)
      if (contentChanged) {
        if (!isCreatorOrOwner) {
          showError(
            "Permission Denied",
            "Only the task creator or project owner can edit task content, assignee, deadline, or attachments."
          );
          return;
        }

        const deadlineTimestamp = new Date(taskFormData.deadline).getTime();
        const startTimeTimestamp = taskFormData.startTime
          ? new Date(taskFormData.startTime).getTime()
          : 0;

        // Upload attachments if any
        let attachmentBlobIds: string[] = [];
        if (taskFormData.attachments && taskFormData.attachments.length > 0) {
          console.log(
            "Uploading attachments for edit:",
            taskFormData.attachments
          );
          attachmentBlobIds = await Promise.all(
            taskFormData.attachments.map((file) =>
              walrusService.uploadFile(file)
            )
          );
        }

        // Merge existing attachments with new ones
        const allAttachments = [
          ...(editingTask.attachments || []),
          ...attachmentBlobIds.map((blobId, index) => ({
            name: taskFormData.attachments[index].name,
            blobId: blobId,
            size: taskFormData.attachments[index].size,
          })),
        ];

        // Create task content with attachment references
        const taskContent = {
          title: taskFormData.title,
          description: taskFormData.description,
          deadline: deadlineTimestamp,
          startTime: startTimeTimestamp,
          attachments: allAttachments,
        };

        await editTask(
          editingTask.id,
          selectedProject.id,
          taskContent,
          taskFormData.assignee
        );
      }

      // Handle status changes (creator OR assignee can do this)
      if (statusChanged) {
        if (!canChangeTaskStatus(editingTask)) {
          showError(
            "Permission Denied",
            "Only the task creator or assignee can change task status."
          );
          return;
        }

        await updateTaskStatus(editingTask.id, taskFormData.status);
      }

      setEditingTask(null);
      resetTaskForm();

      // Show success message
      showSuccess("Task Updated", "Task updated successfully!");

      // Reload tasks for the current project
      if (selectedProject) {
        setTimeout(async () => {
          try {
            const updatedTasks = await loadTasks(selectedProject.id);
            const tasksForProject = updatedTasks.filter(
              (task) => task.allowlistId === selectedProject.id
            );
            setProjectTasks(tasksForProject);
          } catch (error) {
            console.error("Failed to reload tasks after edit:", error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to edit task:", error);
      showError("Task Edit Failed", "Failed to edit task. Please try again.");
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteTaskFromModal = async () => {
    if (!editingTask || !selectedProject) return;

    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      await deleteTask(editingTask.id, selectedProject.id);
      setEditingTask(null);
      resetTaskForm();

      // Show success message
      showSuccess("Task Deleted", "Task deleted successfully!");

      // Reload tasks for the current project
      if (selectedProject) {
        setTimeout(async () => {
          try {
            const updatedTasks = await loadTasks(selectedProject.id);
            const tasksForProject = updatedTasks.filter(
              (task) => task.allowlistId === selectedProject.id
            );
            setProjectTasks(tasksForProject);
          } catch (error) {
            console.error("Failed to reload tasks after deletion:", error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
      showError(
        "Task Deletion Failed",
        "Failed to delete task. Please try again."
      );
    }
  };

  // Check if form data has changed
  useEffect(() => {
    if (!originalTaskData) return;

    const hasChanged =
      taskFormData.title !== (originalTaskData.title || "") ||
      taskFormData.description !== (originalTaskData.description || "") ||
      taskFormData.assignee !== (originalTaskData.assignee || "") ||
      taskFormData.deadline !==
        (originalTaskData.deadline
          ? new Date(originalTaskData.deadline).toISOString().slice(0, 16)
          : "") ||
      taskFormData.startTime !==
        (originalTaskData.startTime
          ? new Date(originalTaskData.startTime).toISOString().slice(0, 16)
          : "") ||
      (taskFormData.status !== undefined &&
        taskFormData.status !== (originalTaskData.status || 0)) ||
      taskFormData.attachments.length > 0; // New attachments count as change

    setHasFormChanged(hasChanged);
  }, [taskFormData, originalTaskData]);

  const resetProjectForm = () => {
    setProjectFormData({
      name: "",
      description: "",
      members: [],
    });
    setMemberInput("");
  };

  const handleAddMember = () => {
    const input = memberInput.trim();
    if (!input) return;

    if (!input.startsWith("0x") || input.length < 10) {
      showError(
        "Invalid Address",
        "Please enter a valid Sui address (starts with 0x)"
      );
      return;
    }

    if (projectFormData.members.includes(input)) {
      showError(
        "Duplicate Member",
        "This address is already added to the members list."
      );
      return;
    }

    setProjectFormData({
      ...projectFormData,
      members: [...projectFormData.members, input],
    });
    setMemberInput("");
  };

  const handleRemoveMember = (address: string) => {
    setProjectFormData({
      ...projectFormData,
      members: projectFormData.members.filter((member) => member !== address),
    });
  };

  const handleMemberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMember();
    }
  };

  // KanbanTaskCard component for Kanban columns
  const KanbanTaskCard = ({ task, onUpdateStatus, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg p-3 shadow-sm hover:bg-gray-100 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Task Title */}
          <div className="mb-2">
            <div className="font-semibold text-gray-900 text-sm truncate">
              {task.title === "Decryption Failed" ? (
                <span className="text-red-500">Decryption Failed</span>
              ) : task.title === "Task Title (Encrypted)" ? (
                <span className="text-yellow-600">
                  Encrypted (requires decryption setup)
                </span>
              ) : (
                task.title
              )}
            </div>
          </div>

          {/* Last modified date */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">
              Last modified {new Date(task.updatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Task Description */}
          <div className="mb-3">
            <div className="text-xs text-gray-600 line-clamp-2">
              {task.description === "Unable to decrypt task content" ? (
                <span className="text-red-500">Unable to decrypt</span>
              ) : task.description ===
                "Task description (requires decryption setup)" ? (
                <span className="text-yellow-600">
                  Encrypted (requires decryption setup)
                </span>
              ) : (
                task.description
              )}
            </div>
          </div>

          {/* Task Details */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User className="w-3 h-3" />
              <span className="font-medium">Assignee:</span>
              <span className="font-mono">
                {task.assignee.slice(0, 6)}...
                {task.assignee.slice(-4)}
              </span>
            </div>
            {task.deadline && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="w-3 h-3" />
                <span className="font-medium">Deadline:</span>
                <span>{formatDateTime(task.deadline)}</span>
              </div>
            )}
            {task.startTime && task.startTime > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Clock className="w-3 h-3" />
                <span className="font-medium">Start:</span>
                <span>{formatDateTime(task.startTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1 ml-2 flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
            title="View task details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!account) {
    return (
      <div className="flex-1 bg-white rounded-l-3xl md:rounded-[2rem] p-6 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Connect Wallet
          </h2>
          <p className="text-gray-500">
            Please connect your wallet to access project management
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-l-3xl md:rounded-[2rem] p-6 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Project Management
          </h1>
          {selectedProject && (
            <div className="flex items-center gap-4 mt-2">
              <span className="text-lg font-medium text-gray-700">
                {selectedProject.name}
              </span>
              <span className="text-sm text-gray-600">
                {selectedProject.memberCount} members
              </span>
              <span className="text-sm text-gray-600">
                {projectTasks.length} tasks
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {selectedProject && (
            <button
              onClick={() => setSelectedProject(null)}
              className=" text-black px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ArrowLeft size={24} className="text-black" />
            </button>
          )}
          <Button
            onClick={() => setShowCreateProject(true)}
            variant="outline"
            disabled={isCreatingProject}
          >
            <FolderOpen className="w-4 h-4" />
            {isCreatingProject ? "Creating..." : "New Project"}
          </Button>
          {selectedProject && (
            <Button
              onClick={() => setShowCreateTask(true)}
              disabled={isCreatingTask}
            >
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {!selectedProject ? (
        /* Projects List View */
        <div className="flex-1 overflow-hidden">
          {projects.length === 0 && !isLoadingProjects ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  No projects yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Create your first project to get started
                </p>
              </div>
            </div>
          ) : isLoadingProjects ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading projects...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="bg-gray-50 rounded-lg p-6 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200 hover:border-blue-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <FolderOpen className="w-8 h-8 text-blue-600" />
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {formatDate(project.createdAt)}
                      </div>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {project.name}
                  </h3>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {project.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {project.memberCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-4 h-4 text-gray-400" />
                        {project.taskCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Project Tasks Kanban View */
        <div className="flex-1 overflow-hidden">
          {/* Kanban Columns */}
          <div className="flex flex-col md:flex-row gap-4 h-full">
            {isLoadingTasks && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Loading tasks...</p>
                </div>
              </div>
            )}
            {/* TODO Column */}
            <div className="flex-1 bg-yellow-50 rounded-lg p-4 min-w-[300px] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-lg font-bold text-yellow-700">TODO</span>
                <span className="ml-2 text-xs text-yellow-700">
                  {projectTasks.filter((t) => t.status === 0).length}
                </span>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto">
                {projectTasks.filter((t) => t.status === 0).length === 0 ? (
                  <div className="text-center text-yellow-500">
                    No TODO tasks
                  </div>
                ) : (
                  projectTasks
                    .filter((t) => t.status === 0)
                    .map((task) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        onUpdateStatus={handleUpdateStatus}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    ))
                )}
              </div>
            </div>
            {/* In Progress Column */}
            <div className="flex-1 bg-blue-50 rounded-lg p-4 min-w-[300px] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-lg font-bold text-blue-700">
                  In Progress
                </span>
                <span className="ml-2 text-xs text-blue-700">
                  {projectTasks.filter((t) => t.status === 1).length}
                </span>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto">
                {projectTasks.filter((t) => t.status === 1).length === 0 ? (
                  <div className="text-center text-blue-500">
                    No In Progress tasks
                  </div>
                ) : (
                  projectTasks
                    .filter((t) => t.status === 1)
                    .map((task) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        onUpdateStatus={handleUpdateStatus}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    ))
                )}
              </div>
            </div>
            {/* Done Column */}
            <div className="flex-1 bg-green-50 rounded-lg p-4 min-w-[300px] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-green-600" />
                <span className="text-lg font-bold text-green-700">Done</span>
                <span className="ml-2 text-xs text-green-700">
                  {projectTasks.filter((t) => t.status === 2).length}
                </span>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto">
                {projectTasks.filter((t) => t.status === 2).length === 0 ? (
                  <div className="text-center text-green-500">
                    No Done tasks
                  </div>
                ) : (
                  projectTasks
                    .filter((t) => t.status === 2)
                    .map((task) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        onUpdateStatus={handleUpdateStatus}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Create New Project</h2>
              <button
                onClick={() => setShowCreateProject(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectFormData.name}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={projectFormData.description}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member Addresses
                </label>
                <input
                  type="text"
                  placeholder="0x... then press Enter to add each address"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  onKeyDown={handleMemberKeyDown}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {projectFormData.members.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {projectFormData.members.map((address, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm"
                      >
                        <span className="text-gray-700 font-mono">
                          {address.slice(0, 6)}
                          ...
                          {address.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleRemoveMember(address)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreateProject(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isCreatingProject}
                >
                  {isCreatingProject ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-start mb-4">
              <h2 className="text-xl font-bold">Create New Task</h2>
              <button
                onClick={() => setShowCreateTask(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignee *
                </label>
                <select
                  value={taskFormData.assignee}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      assignee: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select assignee</option>
                  {projectMembers.map((member) => (
                    <option key={member} value={member}>
                      {member.slice(0, 6)}...
                      {member.slice(-4)}
                    </option>
                  ))}
                </select>
                {projectMembers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No members found. Add members to the project first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={taskFormData.startTime}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      startTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={taskFormData.deadline}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      deadline: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Hidden file input */}
              <input
                ref={taskFileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setTaskFormData({
                    ...taskFormData,
                    attachments: files,
                  });
                }}
                className="hidden"
              />

              {/* Attachments Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments
                </label>
                {taskFormData.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">
                      Attachments ({taskFormData.attachments.length})
                    </h4>
                    {taskFormData.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50 w-fit"
                      >
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <FileText size={24} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskFormData({
                              ...taskFormData,
                              attachments: taskFormData.attachments.filter(
                                (_, i) => i !== index
                              ),
                            });
                          }}
                          className="ml-4 p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  onClick={() => taskFileInputRef.current?.click()}
                  variant="outline"
                >
                  <Paperclip size={20} />
                  Attach
                </Button>
                <Button
                  onClick={() => setShowCreateTask(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} disabled={isCreatingTask}>
                  <Save className="w-4 h-4" />
                  {isCreatingTask ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Task Details</h2>
              <button
                onClick={() => {
                  setEditingTask(null);
                  resetTaskForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title and Description - Full Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                  {!canEditTaskContent(editingTask) && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Read-only - only creator/owner can edit)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      title: e.target.value,
                    })
                  }
                  disabled={!canEditTaskContent(editingTask)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !canEditTaskContent(editingTask)
                      ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                      : "border-gray-300"
                  }`}
                  placeholder="Enter task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                  {!canEditTaskContent(editingTask) && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Read-only)
                    </span>
                  )}
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) =>
                    setTaskFormData({
                      ...taskFormData,
                      description: e.target.value,
                    })
                  }
                  disabled={!canEditTaskContent(editingTask)}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    !canEditTaskContent(editingTask)
                      ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                      : "border-gray-300"
                  }`}
                  placeholder="Enter task description"
                />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignee *
                    {!canEditTaskContent(editingTask) && (
                      <span className="ml-2 text-xs text-gray-500">
                        (Read-only)
                      </span>
                    )}
                  </label>
                  <select
                    value={taskFormData.assignee}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        assignee: e.target.value,
                      })
                    }
                    disabled={!canEditTaskContent(editingTask)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !canEditTaskContent(editingTask)
                        ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select assignee</option>
                    {projectMembers.map((member) => (
                      <option key={member} value={member}>
                        {member.slice(0, 6)}
                        ...
                        {member.slice(-4)}
                      </option>
                    ))}
                  </select>
                  {projectMembers.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      No members found. Add members to project first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                    {/* permission notice removed — control remains disabled when not allowed */}
                  </label>
                  <select
                    value={taskFormData.status || 0}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        status: parseInt(e.target.value),
                      })
                    }
                    disabled={!canChangeTaskStatus(editingTask)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !canChangeTaskStatus(editingTask)
                        ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                  >
                    <option value={0}>To Do</option>
                    <option value={1}>In Progress</option>
                    <option value={2}>Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    value={taskFormData.deadline}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        deadline: e.target.value,
                      })
                    }
                    disabled={!canEditTaskContent(editingTask)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !canEditTaskContent(editingTask)
                        ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={taskFormData.startTime}
                    onChange={(e) =>
                      setTaskFormData({
                        ...taskFormData,
                        startTime: e.target.value,
                      })
                    }
                    disabled={!canEditTaskContent(editingTask)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !canEditTaskContent(editingTask)
                        ? "border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                  />
                </div>
              </div>

              {/* New Attachments Display */}
              {taskFormData.attachments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">
                    New Attachments ({taskFormData.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {taskFormData.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTaskFormData({
                              ...taskFormData,
                              attachments: taskFormData.attachments.filter(
                                (_, i) => i !== index
                              ),
                            });
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show existing attachments if any */}
              {editingTask.attachments &&
                editingTask.attachments.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Attachments ({editingTask.attachments.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {editingTask.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50 w-fit"
                        >
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <FileText size={24} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {attachment.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.size)}
                            </p>
                          </div>
                          <button
                            onClick={() => downloadAttachment(attachment)}
                            className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Download size={20} className="text-gray-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex gap-2 justify-end pt-4">
                <div className="flex gap-2 mr-auto">
                  <input
                    ref={taskFileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setTaskFormData({
                        ...taskFormData,
                        attachments: files,
                      });
                    }}
                    className="hidden"
                  />
                  <Button
                    onClick={() => taskFileInputRef.current?.click()}
                    variant="outline"
                    disabled={isSavingTask || !canEditTaskContent(editingTask)}
                  >
                    <Paperclip size={20} />
                    <span>Attach</span>
                    {/* permission notice removed — Attach button remains disabled when not allowed */}
                  </Button>
                </div>
                <Button
                  onClick={handleDeleteTaskFromModal}
                  disabled={!canDeleteTask(editingTask)}
                  variant="outline"
                  className={`${
                    !canDeleteTask(editingTask)
                      ? "bg-red-300 text-white cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-800 text-white"
                  } font-semibold`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                  {/* permission notice removed — Delete button remains disabled when not allowed */}
                </Button>
                <Button
                  onClick={() => {
                    setEditingTask(null);
                    resetTaskForm();
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleSaveEditTask}
                  disabled={!hasFormChanged || isSavingTask}
                >
                  <Save className="w-4 h-4" />
                  {isSavingTask ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error/Success Modal */}
      <ErrorModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
        message={modalState.message}
      />
    </div>
  );
};

export default Tasks;
