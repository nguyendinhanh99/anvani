"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    orderBy,
    limit,
    collectionGroup
} from "firebase/firestore";
import { updateProfile, updatePassword } from "firebase/auth";

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [customSubjects, setCustomSubjects] = useState(() => {
        if (typeof window !== "undefined") {
            const cached = localStorage.getItem("cached_custom_subjects");
            return cached ? JSON.parse(cached) : [];
        }
        return [];
    });

    const [loading, setLoading] = useState(() => {
        if (typeof window !== "undefined") {
            return !localStorage.getItem("cached_custom_subjects");
        }
        return true;
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [title, setTitle] = useState("");
    const [emoji, setEmoji] = useState("📖");
    const [color, setColor] = useState("from-indigo-500 to-violet-600");

    const [hallOfFame, setHallOfFame] = useState([]);
    const [activeTab, setActiveTab] = useState("subjects");

    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const [showAddVocabModal, setShowAddVocabModal] = useState(false);
    const [newVocabWord, setNewVocabWord] = useState("");
    const [newVocabDef, setNewVocabDef] = useState("");
    const [addingVocab, setAddingVocab] = useState(false);

    const [displayName, setDisplayName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [hometown, setHometown] = useState("");
    const [currentUserName, setCurrentUserName] = useState("");

    const [newPassword, setNewPassword] = useState("");
    const [profileMessage, setProfileMessage] = useState({ text: "", type: "" });
    const [updatingProfile, setUpdatingProfile] = useState(false);

    const colorOptions = [
        { label: "Tím Indigo (Mặc định)", value: "from-indigo-500 to-violet-600" },
        { label: "Đức (Đỏ / Vàng)", value: "from-amber-400 via-red-500 to-yellow-500" },
        { label: "Anh (Xanh dương)", value: "from-blue-500 to-cyan-500" },
        { label: "Xanh lá tươi", value: "from-emerald-400 to-teal-600" },
        { label: "Hồng / Cam năng động", value: "from-rose-400 to-orange-500" },
    ];

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        fetchUserProfileData(user.uid);
        fetchCustomSubjectsFromDB();
        fetchUserScores();
    }, [user, router]);

    const fetchUserProfileData = async (uid) => {
        try {
            const userDocRef = doc(db, "users", uid);
            const userSnap = await getDoc(userDocRef);

            let name = user.displayName || "";
            let bDate = "";
            let hTown = "";

            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.displayName) name = data.displayName;
                bDate = data.birthDate || "";
                hTown = data.hometown || "";
            }

            setDisplayName(name);
            setBirthDate(bDate);
            setHometown(hTown);
            setCurrentUserName(name || user.email || "");
        } catch (error) {
            console.error("Lỗi lấy thông tin profile:", error);
        }
    };

    const fetchCustomSubjectsFromDB = async () => {
        try {
            const q = query(collection(db, "subjects"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const list = [];
            querySnapshot.forEach((document) => {
                list.push({
                    id: document.id,
                    path: document.ref.path,
                    ...document.data()
                });
            });

            setCustomSubjects(list);
            localStorage.setItem("cached_custom_subjects", JSON.stringify(list));
        } catch (error) {
            console.error("Lỗi tải danh sách môn học:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserScores = async () => {
        try {
            const q = query(
                collection(db, "scores"),
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(15)
            );
            const querySnapshot = await getDocs(q);
            const scoresList = [];
            querySnapshot.forEach((doc) => {
                scoresList.push({ id: doc.id, ...doc.data() });
            });
            setHallOfFame(scoresList);
        } catch (error) {
            console.error("Lỗi tải lịch sử điểm số:", error);
        }
    };

    const handleGlobalSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setSearching(true);
        try {
            const lessonsGroupQuery = collectionGroup(db, "lessons");
            const querySnapshot = await getDocs(lessonsGroupQuery);
            const results = [];
            const keyword = searchTerm.toLowerCase().trim();

            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                let subjectName = "Môn học chung";
                try {
                    const subjectRef = docSnap.ref.parent.parent; 
                    if (subjectRef) {
                        const subjectSnap = await getDoc(subjectRef);
                        if (subjectSnap.exists()) {
                            const subjectData = subjectSnap.data();
                            subjectName = subjectData.title || subjectData.name || "Môn học không tên";
                        }
                    }
                } catch (err) {
                    console.warn("Không thể lấy thông tin môn học cha:", err);
                }

                const lessonTitle = data.title || "Bài học không tên";

                if (Array.isArray(data.vocabularies)) {
                    data.vocabularies.forEach((item, index) => {
                        if (item && typeof item === "object") {
                            const word = item.word || "";
                            const meaning = item.meaning || "";
                            const example = item.example || "";
                            const textToCheck = `${word} ${meaning} ${example}`.toLowerCase();

                            if (textToCheck.includes(keyword)) {
                                results.push({
                                    id: `${docSnap.id}_vocab_${index}`,
                                    word: word,
                                    definition: meaning,
                                    example: example,
                                    type: "Từ vựng",
                                    subjectName: subjectName,
                                    lessonTitle: lessonTitle,
                                    lessonId: docSnap.id,
                                    path: docSnap.ref.path
                                });
                            }
                        }
                    });
                }

                if (Array.isArray(data.structures)) {
                    data.structures.forEach((item, index) => {
                        if (item && typeof item === "object") {
                            const allValuesText = Object.values(item)
                                .filter(val => typeof val === "string")
                                .join(" ")
                                .toLowerCase();

                            if (allValuesText.includes(keyword)) {
                                results.push({
                                    id: `${docSnap.id}_struct_${index}`,
                                    word: item.structure || item.pattern || item.title || item.name || Object.values(item)[0] || "Cấu trúc",
                                    definition: item.meaning || item.description || item.translation || "",
                                    example: item.example || "",
                                    type: "Cấu trúc",
                                    subjectName: subjectName,
                                    lessonTitle: lessonTitle,
                                    lessonId: docSnap.id,
                                    path: docSnap.ref.path
                                });
                            }
                        }
                    });
                }
            }
            setSearchResults(results);
        } catch (error) {
            console.error("Lỗi khi quét lessons:", error);
            alert(`Lỗi tra cứu: ${error.message}`);
        } finally {
            setSearching(false);
        }
    };

    const handleAddGlobalVocab = async (e) => {
        e.preventDefault();
        if (!newVocabWord.trim() || !newVocabDef.trim()) return;

        setAddingVocab(true);
        try {
            await addDoc(collection(db, "global_vocabularies"), {
                word: newVocabWord.trim(),
                meaning: newVocabDef.trim(),
                addedBy: user.email,
                userId: user.uid,
                createdAt: serverTimestamp()
            });

            alert("Đóng góp từ vựng thành công! 🎉");
            setNewVocabWord("");
            setNewVocabDef("");
            setShowAddVocabModal(false);
        } catch (error) {
            console.error("Lỗi đóng góp từ vựng:", error);
            alert("Có lỗi xảy ra khi đóng góp.");
        } finally {
            setAddingVocab(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdatingProfile(true);
        setProfileMessage({ text: "", type: "" });

        const currentUser = auth.currentUser;
        if (!currentUser) {
            setProfileMessage({ text: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.", type: "error" });
            setUpdatingProfile(false);
            return;
        }

        try {
            await updateProfile(currentUser, { displayName: displayName.trim() });
            const userDocRef = doc(db, "users", currentUser.uid);
            await setDoc(userDocRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: displayName.trim(),
                birthDate: birthDate,
                hometown: hometown.trim(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            if (newPassword.trim() !== "") {
                if (newPassword.length < 6) throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
                await updatePassword(currentUser, newPassword);
                setNewPassword("");
            }

            setCurrentUserName(displayName.trim());
            setProfileMessage({ text: "Cập nhật hồ sơ thành công! ✨", type: "success" });
        } catch (error) {
            setProfileMessage({ text: error.message || "Có lỗi xảy ra, vui lòng thử lại.", type: "error" });
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingSubject(null);
        setTitle("");
        setEmoji("📖");
        setColor("from-indigo-500 to-violet-600");
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (sub, e) => {
        e.stopPropagation();
        setEditingSubject(sub);
        setTitle(sub.title);
        setEmoji(sub.emoji);
        setColor(sub.color);
        setIsModalOpen(true);
    };

    const handleSubmitSubject = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        if (editingSubject) {
            const updatedList = customSubjects.map((sub) =>
                sub.id === editingSubject.id ? { ...sub, title, emoji, color } : sub
            );
            setCustomSubjects(updatedList);
            localStorage.setItem("cached_custom_subjects", JSON.stringify(updatedList));
            setIsModalOpen(false);

            try {
                const docRef = doc(db, "subjects", editingSubject.id);
                await updateDoc(docRef, { title, emoji, color });
                fetchCustomSubjectsFromDB();
            } catch (error) {
                console.error("Lỗi khi cập nhật môn học:", error);
            }
        } else {
            const tempId = Date.now().toString();
            const newSubject = { id: tempId, userId: user.uid, title, emoji, color, createdAt: new Date().toISOString() };
            const updatedList = [newSubject, ...customSubjects];
            setCustomSubjects(updatedList);
            localStorage.setItem("cached_custom_subjects", JSON.stringify(updatedList));
            setTitle("");
            setIsModalOpen(false);

            try {
                await addDoc(collection(db, "subjects"), {
                    userId: user.uid,
                    title,
                    emoji,
                    color,
                    createdAt: serverTimestamp(),
                });
                fetchCustomSubjectsFromDB();
            } catch (error) {
                console.error("Lỗi khi lưu môn học:", error);
            }
        }
    };

    const handleDeleteSubject = async (subId, e) => {
        e.stopPropagation();
        if (!confirm("Bạn có chắc chắn muốn xóa môn học này không?")) return;

        const updatedList = customSubjects.filter((sub) => sub.id !== subId);
        setCustomSubjects(updatedList);
        localStorage.setItem("cached_custom_subjects", JSON.stringify(updatedList));

        try {
            await deleteDoc(doc(db, "subjects", subId));
        } catch (error) {
            console.error("Lỗi khi xóa môn học:", error);
            fetchCustomSubjectsFromDB();
        }
    };

    if (!user || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Đang đồng bộ dữ liệu đám mây...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-indigo-500 selection:text-white">
            {/* Header Siêu Xịn Sò */}
            <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-2xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3.5 group cursor-pointer" onClick={() => setActiveTab("subjects")}>
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300">
                            <span className="text-xl">🦉</span>
                        </div>
                        <div>
                            <h1 className="font-extrabold text-white text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                                Polyglot & Study Hub
                            </h1>
                            <p className="text-xs text-indigo-400 font-medium tracking-wide">Enterprise Knowledge Base</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tài khoản</span>
                            <span className="text-xs font-bold text-slate-300">{currentUserName || user.email}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold transition-all duration-300 shadow-lg shadow-rose-950/20 active:scale-95"
                        >
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Container Chính */}
            <div className="max-w-7xl mx-auto px-6 pt-8">
                {/* Banner Chào Mừng Đẳng Cấp */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/45 via-slate-900 to-slate-900/90 border border-slate-800/80 p-8 md:p-12 shadow-2xl mb-10 backdrop-blur-xl">
                    <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute right-40 -bottom-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="max-w-xl">
                            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-5 shadow-inner">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Hệ thống đã sẵn sàng tạo môn học</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-white">
                                Chào mừng trở lại, <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{currentUserName || "Học viên"}</span>! ✨
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
                                Quản lý từ vựng, ngữ pháp và ôn tập thông minh trên không gian làm việc đám mây của riêng bạn.
                            </p>
                        </div>

                        <button
                            onClick={handleOpenCreateModal}
                            className="whitespace-nowrap px-6.5 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2.5 border border-indigo-400/20"
                        >
                            <span className="text-lg">＋</span>
                            <span>Tạo môn học mới</span>
                        </button>
                    </div>
                </div>

                {/* Thanh Chuyển Đổi Tab (Tabs Navigation) */}
                <div className="flex items-center space-x-3 mb-8 border-b border-slate-800 pb-4 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab("subjects")}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap flex items-center space-x-2 ${
                            activeTab === "subjects"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30"
                                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                    >
                        <span>📚</span>
                        <span>Sổ tay cá nhân ({customSubjects.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("globalSearch")}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center space-x-2 whitespace-nowrap ${
                            activeTab === "globalSearch"
                                ? "bg-teal-600 text-white shadow-lg shadow-teal-600/30 border border-teal-400/30"
                                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                    >
                        <span>🔍</span>
                        <span>Tra cứu chung (Toàn hệ thống)</span>
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("leaderboard");
                            fetchUserScores();
                        }}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center space-x-2 whitespace-nowrap ${
                            activeTab === "leaderboard"
                                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30 border border-amber-400/30"
                                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                    >
                        <span>🏛️</span>
                        <span>Ngôi đền danh vọng</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center space-x-2 whitespace-nowrap ${
                            activeTab === "profile"
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30 border border-violet-400/30"
                                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                    >
                        <span>⚙️</span>
                        <span>Hồ sơ cá nhân</span>
                    </button>
                </div>

                {/* TAB 1: SỔ TAY MÔN HỌC */}
                {activeTab === "subjects" && (
                    <div>
                        {customSubjects.length === 0 ? (
                            <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 shadow-inner">
                                <span className="text-5xl mb-3 block opacity-70">📓</span>
                                <h4 className="text-base font-bold text-slate-200">Chưa có môn học cá nhân nào</h4>
                                <p className="text-xs text-slate-400 mt-1 mb-6">Hãy tạo môn học đầu tiên để bắt đầu hành trình ghi chép của bạn.</p>
                                <button
                                    onClick={handleOpenCreateModal}
                                    className="px-5 py-3 bg-indigo-600/20 text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-600 hover:text-white transition-all duration-300 border border-indigo-500/30 shadow-lg"
                                >
                                    + Tạo môn học đầu tiên
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {customSubjects.map((sub) => (
                                    <div
                                        key={sub.id}
                                        onClick={() => router.push(`/subjects/${sub.id}`)}
                                        className="group relative cursor-pointer overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800/80 p-7 shadow-xl shadow-slate-950/50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-indigo-500/50 flex flex-col justify-between backdrop-blur-xl"
                                    >
                                        <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${sub.color}`}></div>

                                        <div>
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                                                    {sub.emoji}
                                                </div>

                                                <div className="flex items-center space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleOpenEditModal(sub, e)}
                                                        title="Chỉnh sửa"
                                                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-indigo-500/20 hover:text-indigo-400 text-slate-300 transition"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteSubject(sub.id, e)}
                                                        title="Xóa môn học"
                                                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 transition"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>

                                            <h4 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                                                {sub.title}
                                            </h4>
                                            <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-6 line-clamp-2">
                                                Dữ liệu đồng bộ trực tiếp từ đám mây Firestore.
                                            </p>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4">
                                            <div className="flex items-center text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                                                <span>Mở vở ghi chép</span>
                                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/subjects/${sub.id}/game`);
                                                }}
                                                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 hover:bg-purple-600 hover:text-white transition-all text-xs font-bold border border-purple-500/20 shadow-sm"
                                            >
                                                <span>🎮</span>
                                                <span>Ôn tập</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 1.5: TRA CỨU CHUNG TOÀN HỆ THỐNG */}
                {activeTab === "globalSearch" && (
                    <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl max-w-4xl mx-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                                    <span>🔍</span> Tra Cứu Toàn Hệ Thống
                                </h3>
                                <p className="text-xs md:text-sm text-slate-400 mt-1">Tìm kiếm từ vựng và cấu trúc ngữ pháp từ mọi học viên.</p>
                            </div>
                            <button
                                onClick={() => setShowAddVocabModal(true)}
                                className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs md:text-sm shadow-lg shadow-teal-600/30 transition-all whitespace-nowrap border border-teal-400/20"
                            >
                                + Đóng góp từ vựng
                            </button>
                        </div>

                        <form onSubmit={handleGlobalSearch} className="flex gap-3 mb-8">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nhập từ vựng hoặc cấu trúc cần tìm (VD: Wochenende)..."
                                className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium shadow-inner text-sm"
                            />
                            <button
                                type="submit"
                                disabled={searching}
                                className="px-6 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-600/30 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap text-sm border border-teal-400/20"
                            >
                                {searching ? "Đang tìm..." : "Tra cứu 🚀"}
                            </button>
                        </form>

                        {searching ? (
                            <div className="text-center py-12">
                                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Đang quét cơ sở dữ liệu...</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tìm thấy {searchResults.length} kết quả phù hợp:</p>
                                <div className="grid grid-cols-1 gap-4">
                                    {searchResults.map((item, index) => (
                                        <div key={index} className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-950 transition shadow-md">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <span className="px-3 py-1 text-[11px] font-bold bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 flex items-center gap-1">
                                                    🌐 Môn: {item.subjectName}
                                                </span>
                                                <span className={`px-3 py-1 text-[11px] font-bold rounded-full border ${
                                                    item.type === "Từ vựng" 
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                                        : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                }`}>
                                                    📖 {item.type}
                                                </span>
                                                {item.lessonTitle && (
                                                    <span className="text-xs text-slate-400 ml-auto font-medium">
                                                        Bài học: {item.lessonTitle}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-lg font-bold text-white">{item.word}</h4>
                                            <p className="text-slate-300 text-sm mt-1"><span className="font-semibold text-slate-400">Ý nghĩa:</span> {item.definition}</p>
                                            
                                            {item.example && (
                                                <p className="text-xs md:text-sm text-slate-400 italic mt-2.5 bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                                                    Ví dụ: {item.example}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : searchTerm ? (
                            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                <span className="text-4xl mb-2 block opacity-70">📭</span>
                                <h4 className="text-sm font-bold text-slate-200">Không tìm thấy kết quả nào</h4>
                                <p className="text-xs text-slate-400 mt-1">Không có kết quả nào khớp với từ khóa "{searchTerm}".</p>
                            </div>
                        ) : (
                            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                <span className="text-4xl mb-2 block opacity-70">💡</span>
                                <h4 className="text-sm font-bold text-slate-200">Bắt đầu tra cứu</h4>
                                <p className="text-xs text-slate-400 mt-1">Nhập từ khóa vào ô phía trên để bắt đầu tìm kiếm thông tin.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: NGÔI ĐỀN DANH VỌNG */}
                {activeTab === "leaderboard" && (
                    <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                                    <span>🏛️</span> Ngôi Đền Danh Vọng
                                </h3>
                                <p className="text-xs md:text-sm text-slate-400 mt-1">Lịch sử điểm số các trò chơi ôn tập trên hệ thống.</p>
                            </div>
                        </div>

                        {hallOfFame.length === 0 ? (
                            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                <span className="text-5xl mb-3 block opacity-70">🏆</span>
                                <h4 className="text-sm font-bold text-slate-200">Chưa có dữ liệu điểm số</h4>
                                <p className="text-xs text-slate-400 mt-1">Hãy tham gia chơi các trò chơi ôn tập để ghi danh tại đây!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                            <th className="py-4 px-4">Trò chơi</th>
                                            <th className="py-4 px-4">Điểm số</th>
                                            <th className="py-4 px-4">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-sm">
                                        {hallOfFame.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                                                    <span>🎯</span> {item.gameName || "Trò chơi ôn tập"}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-extrabold text-xs border border-emerald-500/20">
                                                        {item.score} / {item.total} câu đúng
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-xs font-medium text-slate-400">
                                                    {item.createdAt?.seconds
                                                        ? new Date(item.createdAt.seconds * 1000).toLocaleString("vi-VN")
                                                        : "Vừa xong"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: HỒ SƠ CÁ NHÂN */}
                {activeTab === "profile" && (
                    <div className="bg-slate-900/80 rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-800/80 max-w-2xl mx-auto backdrop-blur-xl">
                        <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-slate-800">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-violet-600/30">
                                {currentUserName ? currentUserName.charAt(0).toUpperCase() : "👤"}
                            </div>
                            <div>
                                <h3 className="text-xl md:text-2xl font-black text-white">Quản Lý Hồ Sơ</h3>
                                <p className="text-xs md:text-sm text-slate-400">Tùy chỉnh thông tin định danh và tài khoản.</p>
                            </div>
                        </div>

                        {profileMessage.text && (
                            <div className={`mb-6 p-4 rounded-2xl text-xs md:text-sm font-bold border ${
                                profileMessage.type === "success"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                                {profileMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdateProfile} className="space-y-5 text-sm">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                    Email đăng nhập (Cố định)
                                </label>
                                <input
                                    type="email"
                                    disabled
                                    value={user.email || ""}
                                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3.5 text-slate-500 font-medium cursor-not-allowed shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Tên hiển thị
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Nhập tên hiển thị của bạn..."
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium shadow-inner"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Ngày sinh
                                    </label>
                                    <input
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium shadow-inner"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Quê quán
                                    </label>
                                    <input
                                        type="text"
                                        value={hometown}
                                        onChange={(e) => setHometown(e.target.value)}
                                        placeholder="Nhập quê quán..."
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium shadow-inner"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Đổi mật khẩu mới (Bỏ trống nếu không đổi)
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Ít nhất 6 ký tự..."
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium shadow-inner"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={updatingProfile}
                                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 border border-indigo-400/20"
                                >
                                    {updatingProfile ? "Đang lưu..." : "Lưu thay đổi hồ sơ 💾"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Modal Tạo/Sửa Môn Học */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-fadeIn">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">
                                {editingSubject ? "✏️ Chỉnh sửa môn học" : "📚 Tạo môn học mới"}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmitSubject} className="space-y-4 text-sm">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Tên môn học / Chủ đề
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ví dụ: Tiếng Đức, Tiếng Anh..."
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Biểu tượng (Emoji)
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={2}
                                        value={emoji}
                                        onChange={(e) => setEmoji(e.target.value)}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-xl shadow-inner focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Màu sắc bìa vở
                                    </label>
                                    <select
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-300 shadow-inner focus:border-indigo-500 focus:outline-none"
                                    >
                                        {colorOptions.map((opt, idx) => (
                                            <option key={idx} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-1/2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition border border-indigo-400/20"
                                >
                                    {editingSubject ? "Cập nhật" : "Lưu vào Database"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Đóng Góp Từ Vựng */}
            {showAddVocabModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-fadeIn">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">✨ Đóng góp từ vựng chung</h3>
                            <button
                                onClick={() => setShowAddVocabModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddGlobalVocab} className="space-y-4 text-sm">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Từ vựng / Cấu trúc
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newVocabWord}
                                    onChange={(e) => setNewVocabWord(e.target.value)}
                                    placeholder="Ví dụ: Wochenende..."
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 shadow-inner focus:border-teal-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Nghĩa / Định nghĩa
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newVocabDef}
                                    onChange={(e) => setNewVocabDef(e.target.value)}
                                    placeholder="Ví dụ: Cuối tuần..."
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 shadow-inner focus:border-teal-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddVocabModal(false)}
                                    className="w-1/2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingVocab}
                                    className="w-1/2 rounded-xl bg-teal-600 hover:bg-teal-500 py-3 text-xs font-bold text-white shadow-lg shadow-teal-600/30 transition disabled:opacity-50 border border-teal-400/20"
                                >
                                    {addingVocab ? "Đang gửi..." : "Đóng góp 🚀"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}