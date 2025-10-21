import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, ChevronDown, ChevronRight, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function QnaPage() {
  const [questions, setQuestions] = useState([
    {
      id: 1,
      title: "What is overfitting in Machine Learning?",
      tags: ["Machine Learning", "AI"],
      author: "Raj Gupta",
      image: null,
      upvotes: 12,
      repliesCount: 3,
    },
    {
      id: 2,
      title: "Difference between SQL and NoSQL databases?",
      tags: ["DBMS"],
      author: "Ananya",
      image: null,
      upvotes: 15,
      repliesCount: 2,
    },
  ]);

  const [sortOption, setSortOption] = useState("mostUpvoted");
  const [expanded, setExpanded] = useState({});
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newTags, setNewTags] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [collapsedThreads, setCollapsedThreads] = useState({});

  const handleSort = (option) => setSortOption(option);

  const sortedQuestions = [...questions].sort((a, b) =>
    sortOption === "mostUpvoted" ? b.upvotes - a.upvotes : b.id - a.id
  );

  const handlePostQuestion = () => {
    if (!newQuestion.trim()) return;
    const newQ = {
      id: questions.length + 1,
      title: newQuestion,
      tags: newTags.split(",").map((t) => t.trim()),
      author: "You",
      image: imageFile ? URL.createObjectURL(imageFile) : null,
      upvotes: 0,
      repliesCount: 0,
    };
    setQuestions([...questions, newQ]);
    setNewQuestion("");
    setNewTags("");
    setImageFile(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setImageFile(file);
  };

  const toggleCollapse = (id) =>
    setCollapsedThreads((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Post a Question */}
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
            placeholder="Enter your question..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
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
            <label
              htmlFor="image-upload"
              className="flex items-center gap-2 cursor-pointer text-indigo-600 hover:underline"
            >
              <ImageIcon className="w-5 h-5" /> Upload Image
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            {imageFile && (
              <span className="text-sm text-gray-500">{imageFile.name}</span>
            )}
          </div>
          <Button onClick={handlePostQuestion}>Post Question</Button>
        </CardContent>
      </Card>

      {/* Sort and Filter Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Questions</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">Sort by:</span>
          <select
            value={sortOption}
            onChange={(e) => handleSort(e.target.value)}
            className="border rounded-md p-1 text-gray-700"
          >
            <option value="mostUpvoted">Most Upvoted</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      {!selectedQuestion && (
        <div className="space-y-4">
          {sortedQuestions.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className="p-5 cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-100"
                onClick={() => setSelectedQuestion(q)}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                      {q.title}
                    </h3>
                    <p className="text-sm text-gray-500">Asked by {q.author}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <button className="rounded-md bg-gray-100 hover:bg-indigo-100 transition p-1">
                      <ArrowUp className="w-5 h-5 text-indigo-600" />
                    </button>
                    <span className="text-xs text-gray-600">{q.upvotes}</span>
                  </div>
                </div>

                {q.image && (
                  <img
                    src={q.image}
                    alt="Question"
                    className="mt-3 rounded-md max-h-56 object-cover border"
                  />
                )}

                <div className="flex gap-2 mt-3 flex-wrap">
                  {q.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between mt-3 text-sm text-gray-600">
                  <span>💬 {q.repliesCount} Replies</span>
                  <span
                    className="hover:text-indigo-600 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(q.id);
                    }}
                  >
                    {collapsedThreads[q.id] ? (
                      <div className="flex items-center gap-1">
                        <ChevronRight className="w-4 h-4" /> Expand
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <ChevronDown className="w-4 h-4" /> Collapse
                      </div>
                    )}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected Question Thread */}
      {selectedQuestion && (
        <div>
          <Button
            variant="outline"
            onClick={() => setSelectedQuestion(null)}
            className="mb-4"
          >
            ⬅ Back to Questions
          </Button>
          <Card className="shadow-md border border-gray-100">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-800">
                {selectedQuestion.title}
              </h2>
              <p className="text-sm text-gray-500">
                Posted by {selectedQuestion.author}
              </p>
            </CardHeader>
            <CardContent>
              {selectedQuestion.image && (
                <img
                  src={selectedQuestion.image}
                  alt="Uploaded"
                  className="mb-3 rounded-md max-h-64 object-cover border"
                />
              )}
              <p className="text-gray-700 mb-4">
                Here’s the detailed discussion thread for this question.
              </p>

              {/* Accepted Answer Example */}
              <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded-md mb-3">
                <p className="font-semibold text-green-800">
                  ✔ Accepted Answer by Ananya
                </p>
                <p className="text-gray-700 text-sm">
                  Overfitting happens when your model memorizes the training data instead of learning patterns.
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="border rounded-md p-3 bg-gray-50">
                  <p>
                    Exactly! You can detect it when validation error is much higher than training error.
                  </p>
                  <div className="flex justify-between text-xs mt-2 text-gray-500">
                    <span>by Rohit</span>
                    <span>⬆ 3</span>
                  </div>
                </div>
              </div>

              {/* Reply Box */}
              <div className="mt-4">
                <textarea
                  placeholder="Write your reply..."
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <Button className="mt-2">Post Reply</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
