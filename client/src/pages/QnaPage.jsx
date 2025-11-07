// src/pages/QnaPage.jsx
import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Search,
  Reply as ReplyIcon,
} from "lucide-react";
import { motion } from "framer-motion";

export default function QnaPage() {
  // 👤 Simulated current logged-in user
  const currentUser = "You";

  // 🧩 Questions data (empty by default)
const [questions, setQuestions] = useState([]);


  // 🏆 Class points tracker
  const [classPoints, setClassPoints] = useState({});

  // 🧠 Page state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortOption, setSortOption] = useState("mostUpvoted");
  const [replyText, setReplyText] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [collapsedReplies, setCollapsedReplies] = useState({});

  const nextQuestionId = () =>
    questions.length ? Math.max(...questions.map((q) => q.id)) + 1 : 1;

  // Upload
  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (f) setNewImageFile(f);
  };

  // ✍️ Post new question
  const handlePostQuestion = () => {
    if (!newTitle.trim() || !newDescription.trim()) {
      alert("Please provide both title and description.");
      return;
    }
    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const q = {
      id: nextQuestionId(),
      title: newTitle,
      description: newDescription,
      tags,
      author: currentUser,
      image: newImageFile ? URL.createObjectURL(newImageFile) : null,
      upvotes: 0,
      replies: [],
      createdAt: Date.now(),
    };
    setQuestions((p) => [q, ...p]);
    setNewTitle("");
    setNewDescription("");
    setNewTags("");
    setNewImageFile(null);
  };

  // 🔼 Upvote a question
  const handleUpvoteQuestion = (q) => {
    if (q.author === currentUser) {
      alert("You can’t upvote your own question!");
      return;
    }
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, upvotes: item.upvotes + 1 } : item
      )
    );
    setClassPoints((prev) => ({
      ...prev,
      [q.author]: (prev[q.author] || 0) + 10,
    }));
  };

  // 🔼 Upvote a reply (recursive)
  const addUpvoteToReplies = (replies, targetId) =>
    replies.map((r) => {
      if (r.id === targetId) {
        if (r.author === currentUser) {
          alert("You can’t upvote your own reply!");
          return r;
        }
        setClassPoints((prev) => ({
          ...prev,
          [r.author]: (prev[r.author] || 0) + 10,
        }));
        return { ...r, upvotes: r.upvotes + 1 };
      }
      if (r.replies?.length) {
        return { ...r, replies: addUpvoteToReplies(r.replies, targetId) };
      }
      return r;
    });

  const handleUpvoteReply = (replyObj) => {
    if (!selectedQuestion) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === selectedQuestion.id
          ? { ...q, replies: addUpvoteToReplies(q.replies, replyObj.id) }
          : q
      )
    );
  };

  // 💬 Reply posting
  const addReplyToReplies = (replies, targetId, newReply) =>
    replies.map((r) => {
      if (r.id === targetId) {
        return { ...r, replies: [...r.replies, newReply] };
      }
      return { ...r, replies: addReplyToReplies(r.replies, targetId, newReply) };
    });

  const handlePostReply = () => {
    if (!replyText.trim()) return;
    const newR = {
      id: Date.now(),
      author: currentUser,
      text: replyText.trim(),
      upvotes: 0,
      replies: [],
    };
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === selectedQuestion.id) {
          if (!replyTarget) {
            return { ...q, replies: [...q.replies, newR] };
          } else {
            return {
              ...q,
              replies: addReplyToReplies(q.replies, replyTarget.id, newR),
            };
          }
        }
        return q;
      })
    );
    setReplyText("");
    setReplyTarget(null);
  };

  // 🔽 Collapse replies
  const toggleCollapse = (replyId) =>
    setCollapsedReplies((p) => ({ ...p, [replyId]: !p[replyId] }));

  // 🧠 Search + tags
  const allTags = Array.from(new Set(questions.flatMap((q) => q.tags)));
  const toggleTagSelection = (tag) => {
    setSelectedTags((p) =>
      p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]
    );
  };

  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => q.tags.includes(tag));
    return matchesSearch && matchesTags;
  });

  const sorted = [...filtered].sort((a, b) =>
    sortOption === "mostUpvoted" ? b.upvotes - a.upvotes : b.createdAt - a.createdAt
  );

  // 🧵 Recursive reply renderer
  const ReplyThread = ({ replies = [], depth = 0 }) => {
    if (!replies.length) return null;
    return (
      <div className="space-y-3">
        {replies.map((r) => (
          <div key={r.id} style={{ marginLeft: depth * 18 }}>
            <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-800">{r.text}</p>
                  <p className="text-xs text-gray-500 mt-1">by {r.author}</p>
                </div>
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => handleUpvoteReply(r)}
                    className="p-1 rounded hover:bg-indigo-50"
                  >
                    <ArrowUp className="w-4 h-4 text-indigo-600" />
                  </button>
                  <span className="text-xs text-gray-600">{r.upvotes}</span>
                </div>
              </div>

              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <button
                  onClick={() => setReplyTarget(r)}
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <ReplyIcon className="w-3 h-3" /> Reply
                </button>

                {r.replies?.length > 0 && (
                  <button
                    onClick={() => toggleCollapse(r.id)}
                    className="flex items-center gap-1 hover:text-indigo-600"
                  >
                    {collapsedReplies[r.id] ? (
                      <>
                        <ChevronRight className="w-3 h-3" /> Show replies (
                        {r.replies.length})
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" /> Hide replies (
                        {r.replies.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {!collapsedReplies[r.id] && r.replies?.length > 0 && (
              <div className="mt-2">
                <ReplyThread replies={r.replies} depth={depth + 1} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Post question */}
      <Card className="shadow-md border border-gray-100">
        <CardHeader>
          <h2 className="text-xl font-semibold text-indigo-600 flex items-center gap-2">
            Ask a Question
            <ImageIcon className="w-4 h-4 text-gray-400" />
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Title of your question..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <textarea
            placeholder="Describe your question..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <input
            type="text"
            placeholder="Add tags (comma-separated)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-400 outline-none"
          />
          <div className="flex items-center gap-3">
            <label htmlFor="img" className="flex items-center gap-2 cursor-pointer text-indigo-600 hover:underline">
              <ImageIcon className="w-5 h-5" /> Upload Image
            </label>
            <input id="img" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {newImageFile && <span className="text-sm text-gray-500">{newImageFile.name}</span>}
          </div>
          <Button onClick={handlePostQuestion}>Post Question</Button>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Questions</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 border px-2 py-1 rounded-md bg-white">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="outline-none text-sm w-40 sm:w-64"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTagSelection(tag)}
                className={`px-2 py-1 rounded-full text-xs border ${
                  selectedTags.includes(tag)
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="border rounded-md p-1 text-gray-700"
          >
            <option value="mostUpvoted">Most Upvoted</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Questions list */}
      {!selectedQuestion && (
        <div className="space-y-4">
          {sorted.length > 0 ? (
  sorted.map((q) => (
    <motion.div
      key={q.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="p-5 hover:shadow-lg cursor-pointer border border-gray-100"
        onClick={() => setSelectedQuestion(q)}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">{q.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{q.description}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {q.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpvoteQuestion(q);
              }}
              className="rounded-md p-1 hover:bg-indigo-50"
            >
              <ArrowUp className="w-5 h-5 text-indigo-600" />
            </button>
            <span className="text-xs text-gray-600">{q.upvotes}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  ))
) : questions.length === 0 ? (
  // 👉 No questions exist at all
  <p className="text-gray-500 text-center mt-6">
    No questions yet. Be the first to ask!
  </p>
) : (
  // 👉 There are questions, but none match the filter/search
  <p className="text-gray-500 text-center mt-6">
    No questions match your search or filters.
  </p>
)}

        </div>
      )}

      {/* Expanded question */}
      {selectedQuestion && (
        <div>
          <Button variant="outline" onClick={() => setSelectedQuestion(null)} className="mb-4">
            ⬅ Back
          </Button>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-800">{selectedQuestion.title}</h2>
              <p className="text-gray-600 text-sm">{selectedQuestion.description}</p>
            </CardHeader>
            <CardContent>
              <ReplyThread replies={selectedQuestion.replies} />
              <div className="mt-4 space-y-2">
                {replyTarget ? (
                  <p className="text-xs text-gray-500">
                    Replying to <b>{replyTarget.author}</b>
                    <button onClick={() => setReplyTarget(null)} className="text-indigo-600 underline ml-2">
                      cancel
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Replying to main thread</p>
                )}
                <textarea
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  rows={3}
                />
                <Button onClick={handlePostReply}>Post Reply</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
