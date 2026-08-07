"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, deleteDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function SubjectDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId;

  const [subjectInfo, setSubjectInfo] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [splittingId, setSplittingId] = useState(null);
  const [mergingKey, setMergingKey] = useState(null);

  // States cho Sắp xếp và Bộ lọc
  const [sortBy, setSortBy] = useState("name-asc");
  const [statusFilter, setStatusFilter] = useState("all");

  // States quản lý Modal tách bài học
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [activeLessonToSplit, setActiveLessonToSplit] = useState(null);
  const [chunkSize, setChunkSize] = useState("50");

  // States quản lý Modal Đổi tên bài học
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [activeLessonToRename, setActiveLessonToRename] = useState(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  // States quản lý Modal Xác nhận (Thay thế window.confirm)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Xác nhận",
    isDanger: false
  });

  // States quản lý Toast thông báo (Thay thế window.alert)
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

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
        setSubjectInfo({ title: subjectId === "tieng-duc" ? "Tiếng Đức (Deutsch)" : "Tiếng Anh (English)", emoji: "🌍" });
      }

      const lessonsRef = collection(db, "subjects", subjectId, "lessons");
      const querySnapshot = await getDocs(lessonsRef);
      const list = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const currentStatus = data.status || "unlearned";
        const percent = currentStatus === "mastered" ? 100 : currentStatus === "learning" ? 50 : 0;

        list.push({ 
          id: docSnap.id, 
          ...data,
          status: currentStatus,
          progressPercent: percent
        });
      });
      setLessons(list);
    } catch (error) {
      console.error("Lỗi tải bài học:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e, lessonId, newStatus) => {
    e.stopPropagation();
    try {
      const lessonDocRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(lessonDocRef, { status: newStatus });

      setLessons(lessons.map(les => {
        if (les.id === lessonId) {
          const newPercent = newStatus === "mastered" ? 100 : newStatus === "learning" ? 50 : 0;
          return { ...les, status: newStatus, progressPercent: newPercent };
        }
        return les;
      }));
      showToast("Đã cập nhật trạng thái ôn tập!");
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      showToast("Không thể cập nhật trạng thái, vui lòng thử lại.", "error");
    }
  };

  const handleOpenRenameModal = (e, lesson) => {
    e.stopPropagation();
    setActiveLessonToRename(lesson);
    setNewLessonTitle(lesson.title);
    setShowRenameModal(true);
  };

  const executeRenameLesson = async () => {
    if (!activeLessonToRename || !newLessonTitle.trim()) {
      showToast("Vui lòng nhập tên bài học hợp lệ!", "error");
      return;
    }

    try {
      const lessonDocRef = doc(db, "subjects", subjectId, "lessons", activeLessonToRename.id);
      await updateDoc(lessonDocRef, { title: newLessonTitle.trim() });

      setLessons(lessons.map(les => {
        if (les.id === activeLessonToRename.id) {
          return { ...les, title: newLessonTitle.trim() };
        }
        return les;
      }));

      setShowRenameModal(false);
      setActiveLessonToRename(null);
      showToast("Đổi tên bài học thành công!");
    } catch (error) {
      console.error("Lỗi đổi tên bài học:", error);
      showToast("Đổi tên không thành công, vui lòng thử lại.", "error");
    }
  };

  const handleDeleteLesson = (e, lessonId, lessonTitle) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: "Xóa bài học",
      message: `Bạn có chắc chắn muốn xóa chủ đề "${lessonTitle}" không? Hành động này không thể hoàn tác.`,
      confirmText: "Xóa bài học",
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "subjects", subjectId, "lessons", lessonId));
          setLessons(lessons.filter(les => les.id !== lessonId));
          showToast("Đã xóa bài học thành công!");
        } catch (error) {
          console.error("Lỗi khi xóa bài học:", error);
          showToast("Xóa không thành công, vui lòng thử lại.", "error");
        }
      }
    });
  };

  const handleOpenSplitModal = (e, lesson) => {
    e.stopPropagation();
    const vocabList = lesson.vocabularies || [];
    if (vocabList.length <= 50) {
      showToast("Bài học này có ít hơn hoặc bằng 50 từ, không cần thiết phải tách nhỏ!", "error");
      return;
    }
    setActiveLessonToSplit(lesson);
    setChunkSize("50");
    setShowSplitModal(true);
  };

  const executeSplitLesson = async () => {
    if (!activeLessonToSplit) return;
    const parsedSize = parseInt(chunkSize);
    if (isNaN(parsedSize) || parsedSize <= 0) {
      showToast("Vui lòng nhập số lượng từ vựng hợp lệ lớn hơn 0!", "error");
      return;
    }

    const vocabList = activeLessonToSplit.vocabularies || [];
    setShowSplitModal(false);
    setSplittingId(activeLessonToSplit.id);

    try {
      for (let i = 0; i < vocabList.length; i += parsedSize) {
        const chunkVocabs = vocabList.slice(i, i + parsedSize);
        const partNumber = Math.floor(i / parsedSize) + 1;
        const newTitle = `${activeLessonToSplit.title} - Phần ${partNumber}`;

        await addDoc(collection(db, "subjects", subjectId, "lessons"), {
          title: newTitle,
          vocabularies: chunkVocabs,
          structures: [],
          status: "unlearned",
          createdAt: serverTimestamp(),
        });
      }

      showToast(`Đã tự động tách thành công các phần nhỏ từ bài "${activeLessonToSplit.title}"!`);
      fetchSubjectAndLessons();
    } catch (error) {
      console.error("Lỗi khi tách bài học:", error);
      showToast("Có lỗi xảy ra khi tách bài học, vui lòng thử lại.", "error");
    } finally {
      setSplittingId(null);
      setActiveLessonToSplit(null);
    }
  };

  const handleMergeLessons = (e, lessonTitle) => {
    e.stopPropagation();
    const baseTitle = lessonTitle.replace(/\s*-\s*Phần\s+\d+$/i, "").trim();

    setConfirmModal({
      isOpen: true,
      title: "Gộp lại thành bài gốc",
      message: `Bạn có muốn gộp tất cả các phần của bài "${baseTitle}" lại thành một bài gốc duy nhất không?`,
      confirmText: "Gộp lại ngay",
      isDanger: false,
      onConfirm: async () => {
        setMergingKey(baseTitle);
        try {
          const matchingLessons = lessons.filter(les => {
            const cleanTitle = les.title.replace(/\s*-\s*Phần\s+\d+$/i, "").trim();
            return cleanTitle.toLowerCase() === baseTitle.toLowerCase();
          });

          if (matchingLessons.length <= 1) {
            showToast("Không tìm thấy các phần phụ để gộp!", "error");
            setMergingKey(null);
            return;
          }

          matchingLessons.sort((a, b) => {
            return a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
          });

          let combinedVocabs = [];
          let combinedStructures = [];

          matchingLessons.forEach(les => {
            if (les.vocabularies) combinedVocabs = combinedVocabs.concat(les.vocabularies);
            if (les.structures) combinedStructures = combinedStructures.concat(les.structures);
          });

          await addDoc(collection(db, "subjects", subjectId, "lessons"), {
            title: baseTitle,
            vocabularies: combinedVocabs,
            structures: combinedStructures,
            status: "unlearned",
            createdAt: serverTimestamp(),
          });

          for (const les of matchingLessons) {
            await deleteDoc(doc(db, "subjects", subjectId, "lessons", les.id));
          }

          showToast(`Đã gộp thành công ${matchingLessons.length} phần thành bài "${baseTitle}" (${combinedVocabs.length} từ vựng)!`);
          fetchSubjectAndLessons();
        } catch (error) {
          console.error("Lỗi khi gộp bài học:", error);
          showToast("Có lỗi xảy ra khi gộp bài học, vui lòng thử lại.", "error");
        } finally {
          setMergingKey(null);
        }
      }
    });
  };

  const filteredAndSortedLessons = useMemo(() => {
    let result = [...lessons];

    if (statusFilter !== "all") {
      result = result.filter(item => item.status === statusFilter);
    }

    result.sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
      } else if (sortBy === "name-desc") {
        return b.title.localeCompare(a.title, 'vi', { numeric: true, sensitivity: 'base' });
      } else if (sortBy === "newest") {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === "oldest") {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeA - timeB;
      }
      return 0;
    });

    return result;
  }, [lessons, sortBy, statusFilter]);

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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-indigo-500 selection:text-white relative">
      {/* TOAST THÔNG BÁO HIỆN ĐẠI */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-bounce duration-300">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 text-xs md:text-sm font-bold backdrop-blur-xl ${
            toast.type === "error" 
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50" 
              : "bg-slate-900/90 border-indigo-500/50 text-indigo-200 shadow-indigo-950/50"
          }`}>
            <span>{toast.type === "error" ? "⚠️" : "✨"}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => router.push("/")} className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300 shadow-md">
              <span>←</span>
            </div>
            <span className="font-extrabold text-slate-200 text-sm md:text-base group-hover:text-indigo-400 transition-colors">
              Quay lại Dashboard
            </span>
          </div>
          
          <div className="flex items-center space-x-3">

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

        {/* TOOLBAR: BỘ LỌC VÀ SẮP XẾP */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1.5">
              <span>📊</span> Lọc trạng thái:
            </span>
            {[
              { id: "all", label: "Tất cả", icon: "🌐" },
              { id: "learning", label: "Đang học", icon: "🔥" },
              { id: "unlearned", label: "Chưa thuộc", icon: "⏳" },
              { id: "mastered", label: "Đã thuộc", icon: "✅" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30"
                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <span>🔄</span> Sắp xếp:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="name-asc">Tên: 1 đến n (A - Z)</option>
              <option value="name-desc">Tên: n đến 1 (Z - A)</option>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span>📚</span> Danh sách bài học <span className="text-slate-500 font-normal">({filteredAndSortedLessons.length})</span>
          </h3>
        </div>

        {filteredAndSortedLessons.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 shadow-inner">
            <span className="text-5xl mb-3 block opacity-70">📭</span>
            <h4 className="text-base font-bold text-slate-200">Không tìm thấy bài học phù hợp</h4>
            <p className="text-xs text-slate-400 mt-1 mb-6">Thử thay đổi bộ lọc hoặc tạo bài học mới.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedLessons.map((les) => {
              const statusConfig = {
                mastered: { label: "Đã thuộc", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", bar: "bg-gradient-to-r from-emerald-500 to-teal-400", icon: "✅" },
                learning: { label: "Đang học", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", bar: "bg-gradient-to-r from-amber-500 to-orange-500", icon: "🔥" },
                unlearned: { label: "Chưa thuộc", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30", bar: "bg-gradient-to-r from-rose-500 to-pink-500", icon: "⏳" },
              }[les.status] || { label: "Chưa thuộc", bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700", bar: "bg-slate-600", icon: "📌" };

              const isPartLesson = /\s*-\s*Phần\s+\d+$/i.test(les.title);
              const baseTitle = les.title.replace(/\s*-\s*Phần\s+\d+$/i, "").trim();

              return (
                <div 
                  key={les.id} 
                  onClick={() => router.push(`/subjects/${subjectId}/lessons/${les.id}`)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800/80 p-7 shadow-xl shadow-slate-950/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-indigo-500/50 flex flex-col justify-between backdrop-blur-xl"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      {/* DROPDOWN TRẠNG THÁI */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={les.status}
                          onChange={(e) => handleUpdateStatus(e, les.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} focus:outline-none cursor-pointer shadow-sm transition`}
                        >
                          <option value="unlearned" className="bg-slate-900 text-rose-400">⏳ Chưa thuộc</option>
                          <option value="learning" className="bg-slate-900 text-amber-400">🔥 Đang học</option>
                          <option value="mastered" className="bg-slate-900 text-emerald-400">✅ Đã thuộc</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={(e) => handleOpenRenameModal(e, les)}
                          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-indigo-500/20 hover:text-indigo-400 text-slate-400 transition shadow-sm"
                          title="Đổi tên bài học"
                        >
                          ✏️
                        </button>
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
                    
                    {/* THANH TRẠNG THÁI (PROGRESS BAR) */}
                    <div className="mb-4 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/60 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <span>📈</span> Tiến độ ôn tập:
                        </span>
                        <strong className={statusConfig.text}>{les.progressPercent}%</strong>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 shadow-sm ${statusConfig.bar}`} 
                          style={{ width: `${les.progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                        <span>📚 Từ vựng: <strong className="text-slate-200">{les.vocabularies?.length || 0}</strong></span>
                        <span>⚡ Cấu trúc: <strong className="text-slate-200">{les.structures?.length || 0}</strong></span>
                      </div>
                    </div>

                    {les.vocabularies && les.vocabularies.length > 50 && !isPartLesson && (
                      <button
                        onClick={(e) => handleOpenSplitModal(e, les)}
                        disabled={splittingId === les.id}
                        className="w-full mb-4 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-inner"
                      >
                        <span>⚡</span>
                        <span>{splittingId === les.id ? "Đang xử lý tách..." : "Tự động tách bài nhỏ"}</span>
                      </button>
                    )}

                    {isPartLesson && (
                      <button
                        onClick={(e) => handleMergeLessons(e, les.title)}
                        disabled={mergingKey === baseTitle}
                        className="w-full mb-4 py-2.5 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-inner"
                      >
                        <span>🔗</span>
                        <span>{mergingKey === baseTitle ? "Đang gộp lại..." : "Gộp lại thành bài gốc"}</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      <span>Xem chi tiết</span> <span>→</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/subjects/${subjectId}/game?lessonId=${les.id}`);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold border border-purple-500/30 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      title="Chơi game ôn tập riêng bài này"
                    >
                      <span>🎮</span> Chơi game
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN CHUNG (THAY THẾ WINDOW.CONFIRM) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-40 h-40 rounded-bl-full pointer-events-none blur-xl ${
              confirmModal.isDanger ? "bg-rose-500/10" : "bg-teal-500/10"
            }`}></div>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${
                confirmModal.isDanger 
                  ? "bg-rose-500/20 border-rose-500/30 text-rose-400" 
                  : "bg-teal-500/20 border-teal-500/30 text-teal-400"
              }`}>
                {confirmModal.isDanger ? "⚠️" : "🔗"}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
                <p className="text-xs text-slate-400">Hệ thống yêu cầu xác nhận thao tác</p>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-300 font-medium mb-8 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700/50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-lg transition active:scale-95 border ${
                  confirmModal.isDanger 
                    ? "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/25 border-rose-400/20" 
                    : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-600/25 border-teal-400/20"
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TÁCH BÀI HỌC */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-bl-full pointer-events-none blur-xl"></div>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl text-amber-400">
                ⚡
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Tự động tách bài học</h3>
                <p className="text-xs text-slate-400">Tối ưu hóa quá trình học tập từng phần</p>
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 mb-6 space-y-2">
              <div className="text-xs text-slate-300">
                Bài học: <strong className="text-amber-300">{activeLessonToSplit?.title}</strong>
              </div>
              <div className="text-xs text-slate-300">
                Tổng số từ vựng: <strong className="text-white">{activeLessonToSplit?.vocabularies?.length || 0} từ</strong>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Số lượng từ vựng mong muốn cho mỗi bài học nhỏ:
              </label>
              <input
                type="number"
                min="10"
                max={activeLessonToSplit?.vocabularies?.length || 100}
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition font-medium"
                placeholder="Ví dụ: 50"
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700/50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeSplitLesson}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition active:scale-95 border border-amber-400/20"
              >
                Xác nhận tách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI TÊN BÀI HỌC */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-bl-full pointer-events-none blur-xl"></div>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl text-indigo-400">
                ✏️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Đổi tên bài học</h3>
                <p className="text-xs text-slate-400">Cập nhật tiêu đề chủ đề trực tuyến</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Tên bài học mới:
              </label>
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition font-medium"
                placeholder="Nhập tên bài học..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700/50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeRenameLesson}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition active:scale-95 border border-indigo-400/20"
              >
                Lưu tên mới
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}