"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, deleteDoc } from "firebase/firestore";

export default function SubjectDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId;

  const [subjectInfo, setSubjectInfo] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchSubjectAndLessons();
  }, [user, subjectId]);

  const fetchSubjectAndLessons = async () => {
    try {
      const subDocRef = doc(db, "subjects", subjectId);
      const subDocSnap = await getDoc(subDocRef);
      if (subDocSnap.exists()) {
        setSubjectInfo(subDocSnap.data());
      } else {
        setSubjectInfo({ title: subjectId === "tieng-duc" ? "Tiếng Đức (Deutsch)" : "Tiếng Anh (English)", emoji: "🌍", color: "from-indigo-500 to-violet-600" });
      }

      const lessonsRef = collection(db, "subjects", subjectId, "lessons");
      const querySnapshot = await getDocs(lessonsRef);
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLessons(list);
    } catch (error) {
      console.error("Lỗi tải bài học:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLesson = async (e, lessonId, lessonTitle) => {
    e.stopPropagation();
    
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa chủ đề "${lessonTitle}" không?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "subjects", subjectId, "lessons", lessonId));
      setLessons(lessons.filter(les => les.id !== lessonId));
    } catch (error) {
      console.error("Lỗi khi xóa bài học:", error);
      alert("Xóa không thành công, vui lòng thử lại.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Đang tải danh sách bài học...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-indigo-500 selection:text-white">
      {/* Header Siêu Xịn Sò */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            onClick={() => router.push("/")}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300 shadow-md">
              <span>←</span>
            </div>
            <span className="font-extrabold text-slate-200 text-sm md:text-base group-hover:text-indigo-400 transition-colors">
              Quay lại Dashboard
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/subjects/${subjectId}/game`)}
              className="px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-600 text-purple-300 hover:text-white font-bold text-xs md:text-sm border border-purple-500/20 shadow-lg shadow-purple-950/20 transition-all duration-300 flex items-center space-x-2 active:scale-95"
            >
              <span>🎮</span>
              <span className="hidden sm:inline">Ôn tập môn học</span>
            </button>

            <button
              onClick={() => router.push(`/subjects/${subjectId}/add-lesson`)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs md:text-sm shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center space-x-2 border border-indigo-400/20"
            >
              <span className="text-base">＋</span>
              <span>Tạo bài học mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <div className="max-w-7xl mx-auto px-6 pt-10">
        {/* Banner Thông Tin Môn Học */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900/90 border border-slate-800/80 p-8 shadow-2xl mb-10 backdrop-blur-xl">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center space-x-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-4xl shadow-inner shrink-0">
              {subjectInfo?.emoji || "📖"}
            </div>
            <div>
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <span>Không gian môn học</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{subjectInfo?.title}</h1>
              <p className="text-slate-400 text-xs md:text-sm font-medium mt-1">Quản lý lịch sử bài học và các chủ đề chuyên sâu trực tuyến.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span>📚</span> Danh sách bài học <span className="text-slate-500 font-normal">({lessons.length})</span>
          </h3>
        </div>

        {lessons.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 shadow-inner">
            <span className="text-5xl mb-3 block opacity-70">📭</span>
            <h4 className="text-base font-bold text-slate-200">Chưa có bài học nào được tạo</h4>
            <p className="text-xs text-slate-400 mt-1 mb-6">Hãy bắt đầu thêm bài học đầu tiên vào môn học này.</p>
            <button 
              onClick={() => router.push(`/subjects/${subjectId}/add-lesson`)} 
              className="px-5 py-3 bg-indigo-600/20 text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-600 hover:text-white transition-all duration-300 border border-indigo-500/30 shadow-lg"
            >
              + Tạo bài học đầu tiên ngay
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((les) => (
              <div 
                key={les.id} 
                onClick={() => router.push(`/subjects/${subjectId}/lessons/${les.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800/80 p-7 shadow-xl shadow-slate-950/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-indigo-500/50 flex flex-col justify-between backdrop-blur-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Chủ đề bài học
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {les.createdAt?.toDate ? les.createdAt.toDate().toLocaleDateString('vi-VN') : "Gần đây"}
                      </span>
                      <button
                        onClick={(e) => handleDeleteLesson(e, les.id, les.title)}
                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition shadow-sm"
                        title="Xóa bài học"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors mb-3 line-clamp-2">
                    {les.title}
                  </h4>
                  
                  <div className="space-y-1.5 text-xs text-slate-400 mb-6 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/60">
                    <div className="flex justify-between">
                      <span>📚 Từ vựng:</span>
                      <strong className="text-slate-200">{les.vocabularies?.length || 0} từ</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>⚡ Cấu trúc:</span>
                      <strong className="text-slate-200">{les.structures?.length || 0} cấu trúc</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Xem chi tiết nội dung</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}