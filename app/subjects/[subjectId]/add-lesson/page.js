"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AddLessonPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId;

  const [title, setTitle] = useState("");
  const [readingContent, setReadingContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    try {
      const lessonData = {
        title: title, // Tên bài / Chủ đề (Ví dụ: Familie)
        readingContent: readingContent,
        vocabularies: [], // Mảng chứa các từ vựng thuộc bài này
        structures: [],   // Mảng chứa các cấu trúc thuộc bài này
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "subjects", subjectId, "lessons"), lessonData);
      router.push(`/subjects/${subjectId}`);
    } catch (error) {
      console.error("Lỗi tạo bài học:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <button 
            onClick={() => router.push(`/subjects/${subjectId}`)}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-semibold transition"
          >
            <span className="text-xl">←</span>
            <span>Quay lại</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Tạo bài học mới</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-10">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Thêm Chủ đề / Bài học mới</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Tên bài học / Chủ đề (Ví dụ: Familie)</label>
              <input 
                type="text" 
                required 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Nhập tên chủ đề..." 
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Nội dung bài đọc (Tùy chọn)</label>
              <textarea 
                value={readingContent} 
                onChange={(e) => setReadingContent(e.target.value)} 
                placeholder="Dán nội dung bài đọc hoặc văn bản của chủ đề này..." 
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm h-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed" 
              />
            </div>

            <div className="flex space-x-4 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => router.push(`/subjects/${subjectId}`)} 
                className="w-1/2 rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="w-1/2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
              >
                {loading ? "Đang tạo..." : "Lưu bài học"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}