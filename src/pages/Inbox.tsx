import { useState } from "react";
import { ArrowLeft, Reply, FileText, Download } from "lucide-react";
import Button from "../components/Button";

interface Email {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  attachment?: {
    name: string;
    size: string;
  };
}

const Inbox = () => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const emails: Email[] = [
    {
      id: 1,
      sender: "Team Sui",
      subject: "Welcome to Sui Mail",
      preview: "We are excited to have you here...",
      body: "Hi Tuan,\n\nWe are excited to have you here. Sui Mail is the best way to manage your emails on the Sui network. We hope you enjoy using our platform.\n\nIf you have any questions, feel free to reach out to us.\n\nBest regards,\nTeam Sui",
      time: "10:30 AM",
      unread: true,
      attachment: { name: "welcome-guide.pdf", size: "2.4 MB" },
    },
    {
      id: 2,
      sender: "GitHub",
      subject: "Security alert",
      preview: "A new sign-in on Mac...",
      body: "We noticed a new sign-in to your GitHub account from a Mac device. If this was you, you can ignore this email. If not, please change your password immediately.",
      time: "Yesterday",
      unread: false,
    },
    {
      id: 3,
      sender: "Dribbble",
      subject: "Top designs of the week",
      preview: "Check out these amazing shots...",
      body: "Here are the top designs of the week on Dribbble. Check them out and get inspired!",
      time: "Yesterday",
      unread: false,
      attachment: { name: "design-trends-2025.pdf", size: "5.1 MB" },
    },
  ];

  if (selectedEmail) {
    return (
      <div className="p-8 h-full flex flex-col relative">
        <button
          onClick={() => setSelectedEmail(null)}
          className="mb-6 p-2 hover:bg-black/5 rounded-full w-fit transition-colors"
        >
          <ArrowLeft size={24} className="text-black" />
        </button>

        <div className="flex-1 overflow-y-auto pr-2">
          <h1 className="text-3xl font-bold text-black mb-6">
            {selectedEmail.subject}
          </h1>

          <div className="flex justify-between items-center mb-8 pb-4 border-b border-black/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-black font-bold">
                {selectedEmail.sender[0]}
              </div>
              <span className="font-semibold text-black text-lg">
                {selectedEmail.sender}
              </span>
            </div>
            <span className="text-black/60">{selectedEmail.time}</span>
          </div>

          <div className="text-black/80 whitespace-pre-wrap leading-relaxed mb-8">
            {selectedEmail.body}
          </div>

          {selectedEmail.attachment && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-black/60 mb-3">
                Attachments
              </h3>
              <div className="flex items-center gap-4 p-4 rounded-xl border border-black/10 bg-white/50 w-fit">
                <div className="p-2 bg-secondary/30 rounded-lg">
                  <FileText size={24} className="text-black" />
                </div>
                <div>
                  <p className="font-medium text-black text-sm">
                    {selectedEmail.attachment.name}
                  </p>
                  <p className="text-xs text-black/50">
                    {selectedEmail.attachment.size}
                  </p>
                </div>
                <button className="ml-4 p-2 hover:bg-black/5 rounded-lg transition-colors">
                  <Download size={20} className="text-black/70" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-8 right-8">
          <Button variant="outline">
            <Reply size={20} />
            <span className="font-medium">Reply</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Inbox</h1>
        <div className="text-sm text-gray-500">3 messages</div>
      </header>

      <div className="space-y-2">
        {emails.map((email) => (
          <div
            key={email.id}
            onClick={() => setSelectedEmail(email)}
            className={`p-4 rounded-2xl border border-gray hover:bg-muted cursor-pointer transition-colors group ${
              email.unread ? "bg-muted/85" : "bg-gray"
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-black font-semibold">{email.sender}</h3>
              <span className="text-xs text-black">{email.time}</span>
            </div>
            <h4
              className={`text-sm mb-1 ${
                email.unread ? "text-gray-800 font-medium" : "text-gray-600"
              }`}
            >
              {email.subject}
            </h4>
            <p className="text-sm text-gray-500 line-clamp-1">
              {email.preview}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inbox;
