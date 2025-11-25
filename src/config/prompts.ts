/**
 * AI Assistant Prompts and System Instructions
 */

interface TaskInfo {
  id: string;
  blobId: string;
  creator: string;
  assignee: string;
  status: number; // 0=TODO, 1=IN_PROGRESS, 2=DONE
  deadline: number;
  startTime: number;
  allowlistId: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  // Decrypted task content
  title?: string;
  description?: string;
  attachments?: any[];
}

interface AllowlistInfo {
  id: string;
  name: string;
  description: string;
  owner: string;
  memberCount: number;
  taskCount: number;
  createdAt: number;
  updatedAt: number;
}

interface MailData {
  inbox: any[];
  sent: any[];
  currentMail: any;
  tasks: TaskInfo[];
  allowlists: AllowlistInfo[];
  lastUpdated: number;
}

/**
 * Generate the system prompt for AI assistant
 */
export function generateSystemPrompt(mailData: MailData, currentAddress?: string): string {
  let contextInfo = "";

  // User context
  if (currentAddress) {
    contextInfo += `## Current User:\n- Address: ${currentAddress.slice(0, 10)}...${currentAddress.slice(-8)}\n\n`;
  }

  // Current email context
  if (mailData.currentMail) {
    contextInfo += `## Currently Selected Email:\n`;
    contextInfo += `- Subject: ${mailData.currentMail.subject || "No subject"}\n`;
    contextInfo += `- From: ${mailData.currentMail.sender || "Unknown sender"}\n`;
    contextInfo += `- To: ${mailData.currentMail.recipients?.join(", ") || "No recipients"}\n`;
    contextInfo += `- Date: ${mailData.currentMail.time || "Unknown date"}\n`;
    if (mailData.currentMail.body) {
      contextInfo += `- Content: ${mailData.currentMail.body.replace(/<[^>]*>/g, "").substring(0, 400)}${
        mailData.currentMail.body.length > 400 ? "..." : ""
      }\n`;
    }
    contextInfo += `- Attachments: ${mailData.currentMail.attachments?.length || 0} files\n\n`;
  }

  // Recent emails summary
  const recentInbox = mailData.inbox.slice(0, 3);
  const recentSent = mailData.sent.slice(0, 3);

  if (recentInbox.length > 0) {
    contextInfo += `## Recent Received Emails (last 3):\n`;
    recentInbox.forEach((mail, index) => {
      contextInfo += `${index + 1}. ${mail.subject || "No subject"} - From: ${
        mail.sender || "Unknown"
      } - ${mail.time || "No date"}\n`;
    });
    contextInfo += "\n";
  }

  if (recentSent.length > 0) {
    contextInfo += `## Recent Sent Emails (last 3):\n`;
    recentSent.forEach((mail, index) => {
      contextInfo += `${index + 1}. ${mail.subject || "No subject"} - To: ${
        mail.recipients?.join(", ") || "No recipients"
      } - ${mail.time || "No date"}\n`;
    });
    contextInfo += "\n";
  }

  // Tasks context
  if (mailData.tasks.length > 0) {
    contextInfo += `## Tasks:\n`;
    const statusLabels = ["TODO", "IN PROGRESS", "DONE"];

    mailData.tasks
      .filter(task => !task.deleted)
      .forEach((task, index) => {
        const statusLabel = statusLabels[task.status] || "UNKNOWN";
        const deadline = task.deadline > 0 ? new Date(task.deadline).toLocaleDateString() : "No deadline";
        const startTime = task.startTime > 0 ? new Date(task.startTime).toLocaleDateString() : "No start date";
        const isCreator = task.creator === currentAddress;
        const isAssignee = task.assignee === currentAddress;
        const userRole = isCreator ? "(Creator)" : isAssignee ? "(Assignee)" : "(Observer)";

        // Use decrypted title and description if available, fallback to blobId
        const taskTitle = task.title && task.title !== "No Title" && task.title !== "Task Title (Encrypted)"
          ? task.title
          : `Task ${task.id.slice(0, 8)}...${task.id.slice(-6)}`;

        const taskDescription = task.description && task.description !== "No Description" && task.description !== "Task description (requires decryption setup)"
          ? task.description
          : "Task description requires decryption";

        contextInfo += `${index + 1}. ${statusLabel} - "${taskTitle}"\n`;
        contextInfo += `   Description: ${taskDescription}\n`;
        contextInfo += `   Assignee: ${task.assignee.slice(0, 8)}...${task.assignee.slice(-6)} ${userRole}\n`;
        contextInfo += `   Start: ${startTime}\n`;
        contextInfo += `   Deadline: ${deadline}\n`;
      });
    contextInfo += "\n";
  }

  // Allowlists context (only show non-mail allowlists)
  const projectAllowlists = mailData.allowlists.filter(al => !al.name.startsWith("Mail:"));
  if (projectAllowlists.length > 0) {
    contextInfo += `## Projects:\n`;
    projectAllowlists.forEach((project, index) => {
      const isOwner = project.owner === currentAddress;
      const userRole = isOwner ? "(Owner)" : "(Member)";
      contextInfo += `${index + 1}. ${project.name} - ${project.taskCount} tasks - ${project.memberCount} members ${userRole}\n`;
      contextInfo += `   Created: ${new Date(project.createdAt).toLocaleDateString()}\n`;
    });
    contextInfo += "\n";
  }

  return `You are an AI assistant for Sui Mail, a decentralized email application on Sui blockchain with integrated task management. Help the user with their mail, tasks, and SUI transfers.

${contextInfo}## Your Capabilities:
- Analyze and summarize emails
- Help draft replies and new emails
- Search through mail history for specific information
- Suggest improvements to email content
- Provide email etiquette advice
- Explain encryption and blockchain features
- Help organize and manage emails
- **Task Management**: Create, update, track tasks and projects
- **Detect and process SUI transfer requests**

## Task Management Help:
- Answer questions about task status, deadlines, and assignments
- Help organize tasks by priority (deadline, status, etc.)
- Explain task relationships and project organization
- Provide suggestions for task management and productivity
- Keep answers focused on the specific task information requested

## SUI Transfer Instructions:
When the user asks to transfer SUI to addresses (shown as "address 1", "address 2", etc.), you MUST respond with a JSON array in this exact format:
[{"amount": 0.5, "to": "address 1"}, {"amount": 1.0, "to": "address 2"}]

## Instructions:
- Use the provided context to give personalized assistance
- When asked about specific emails or tasks, reference the content from the context
- Be concise but thorough in your responses
- Format your responses with clear structure using markdown
- For task questions, provide simple, direct answers focused on what the user asked
- If you need more information about a specific item, ask the user to select it

Current time: ${new Date().toLocaleString()}`;
}

/**
 * Generate a simple task summary prompt
 */
export function generateTaskSummaryPrompt(tasks: TaskInfo[]): string {
  const statusLabels = ["TODO", "IN PROGRESS", "DONE"];

  let summary = "## Task Summary:\n";
  tasks
    .filter(task => !task.deleted)
    .forEach((task, index) => {
      const statusLabel = statusLabels[task.status] || "UNKNOWN";
      const deadline = task.deadline > 0 ? new Date(task.deadline).toLocaleDateString() : "No deadline";

      // Use decrypted title if available, fallback to task ID
      const taskTitle = task.title && task.title !== "No Title" && task.title !== "Task Title (Encrypted)"
        ? task.title
        : `Task ${task.id.slice(0, 8)}...${task.id.slice(-6)}`;

      summary += `${index + 1}. ${statusLabel}: ${taskTitle}\n`;
      summary += `   Assignee: ${task.assignee.slice(0, 8)}...${task.assignee.slice(-6)}\n`;
      summary += `   Deadline: ${deadline}\n\n`;
    });

  return summary;
}

/**
 * Generate a project summary prompt
 */
export function generateProjectSummaryPrompt(allowlists: AllowlistInfo[]): string {
  const projectAllowlists = allowlists.filter(al => !al.name.startsWith("Mail:"));

  let summary = "## Project Summary:\n";
  projectAllowlists.forEach((project, index) => {
    summary += `${index + 1}. ${project.name}\n`;
    summary += `   ${project.taskCount} active tasks\n`;
    summary += `   ${project.memberCount} members\n`;
    summary += `   Created: ${new Date(project.createdAt).toLocaleDateString()}\n\n`;
  });

  return summary;
}