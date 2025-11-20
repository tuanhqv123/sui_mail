import { useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import Button from "../components/Button";
import { Send } from "lucide-react";

const Compose = () => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const handleSend = () => {
    const emailData = {
      to,
      subject,
      content, // This is the HTML content from Quill
      timestamp: new Date().toISOString(),
    };

    console.log("Exported Email HTML:", content);
    console.log("Full Email Data:", emailData);

    // Reset form
    setTo("");
    setSubject("");
    setContent("");
    alert("Email sent! Check console for HTML output.");
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "bullet",
    "indent",
    "link",
    "image",
  ];

  return (
    <div className="p-8 h-full flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Compose</h1>
      </header>

      <div className="flex-1 flex flex-col gap-6 bg-white rounded-2xl p-8 shadow-sm border border-gray">
        <div className="space-y-2">
          <div>
            <input
              type="email"
              placeholder="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full text-normal py-2 border-b border-gray focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-normal font-semibold py-2 border-b border-gray focus:outline-none focus:border-black transition-colors placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 relative">
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            className="h-[calc(100%-3rem)]"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSend} variant="outline">
            <Send size={20} />
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Compose;
