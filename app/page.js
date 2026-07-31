"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
    collectionGroup,
    increment,
    onSnapshot
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

    // --- STATE CHO TOAST NOTIFICATION ---
    const [toast, setToast] = useState({ show: false, message: "", type: "success" });

    const showToast = (message, type = "success") => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, show: false }));
        }, 3500);
    };

    // --- STATE THỜI GIAN & HẸN GIỜ ---
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [totalStudyTime, setTotalStudyTime] = useState(0);
    const [dailyHistory, setDailyHistory] = useState([]);
    const startTimeRef = useRef(Date.now());

    // --- STATE CHỐNG TREO MÁY ---
    const [isIdle, setIsIdle] = useState(false);
    const idleTimerRef = useRef(null);
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

    // State Hẹn giờ (Timer)
    const [targetMinutes, setTargetMinutes] = useState(25);
    const [remainingTimerSeconds, setRemainingTimerSeconds] = useState(25 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // State Online & Bảng xếp hạng
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [studyLeaderboard, setStudyLeaderboard] = useState([]);

    // --- STATE THẢ TIM & LỜI ĐỘNG VIÊN ---
    const [selectedUserForCheer, setSelectedUserForCheer] = useState(null);
    const [cheerMessage, setCheerMessage] = useState("");
    const [isCheerModalOpen, setIsCheerModalOpen] = useState(false);
    const [sendingCheer, setSendingCheer] = useState(false);
    const [incomingCheers, setIncomingCheers] = useState([]);
    
    // State mở modal xem tất cả lời động viên
    const [isAllCheersModalOpen, setIsAllCheersModalOpen] = useState(false);

    // --- XỬ LÝ SỰ KIỆN IDLE ---
    useEffect(() => {
        const resetIdleTimer = () => {
            if (isIdle) {
                setIsIdle(false);
                startTimeRef.current = Date.now() - sessionSeconds * 1000;
            }

            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

            idleTimerRef.current = setTimeout(() => {
                setIsIdle(true);
            }, IDLE_TIMEOUT_MS);
        };

        const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
        events.forEach((event) => {
            window.addEventListener(event, resetIdleTimer);
        });

        resetIdleTimer();

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            events.forEach((event) => {
                window.removeEventListener(event, resetIdleTimer);
            });
        };
    }, [isIdle, sessionSeconds]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!isIdle) {
                setSessionSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);

        return () => {
            clearInterval(timer);
            saveStudyTimeSession();
        };
    }, [user, isIdle]);

    useEffect(() => {
        if (!user) return;

        const updatePresence = async (currentSubjectName = "Tổng quan Dashboard") => {
            try {
                const userStatusRef = doc(db, "online_users", user.uid);
                if (isIdle) {
                    await setDoc(userStatusRef, {
                        currentSubject: "💤 Đang treo máy / Rời đi",
                        lastActive: serverTimestamp()
                    }, { merge: true });
                } else {
                    await setDoc(userStatusRef, {
                        uid: user.uid,
                        email: user.email,
                        displayName: displayName || user.displayName || user.email,
                        currentSubject: currentSubjectName,
                        lastActive: serverTimestamp()
                    }, { merge: true });
                }
            } catch (error) {
                console.error("Lỗi cập nhật trạng thái online:", error);
            }
        };

        updatePresence();
        const heartbeatInterval = setInterval(() => updatePresence(), 30000);

        const q = collection(db, "online_users");
        const unsubscribePresence = onSnapshot(q, (snapshot) => {
            const list = [];
            const now = Date.now();
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.lastActive) {
                    const lastActiveTime = data.lastActive.toMillis ? data.lastActive.toMillis() : now;
                    if (now - lastActiveTime <= 120000) {
                        list.push({
                            id: docSnap.id,
                            ...data
                        });
                    }
                }
            });
            setOnlineUsers(list);
        });

        return () => {
            clearInterval(heartbeatInterval);
            unsubscribePresence();
        };
    }, [user, displayName, isIdle]);

    // Lấy danh sách lời động viên (Tăng giới hạn lên 50 để xem đầy đủ hơn trong Modal)
    useEffect(() => {
        if (!user) return;
        const cheersQuery = query(
            collection(db, "users", user.uid, "cheers"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribeCheers = onSnapshot(cheersQuery, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            setIncomingCheers(list);
        });

        return () => unsubscribeCheers();
    }, [user]);

    useEffect(() => {
        const fetchStudyLeaderboard = async () => {
            try {
                const usersQuery = query(collection(db, "users"), limit(50));
                const querySnapshot = await getDocs(usersQuery);
                const list = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    list.push({
                        uid: docSnap.id,
                        displayName: data.displayName || data.email || "Học viên ẩn danh",
                        totalStudyTimeSeconds: data.totalStudyTimeSeconds || 0
                    });
                });

                list.sort((a, b) => b.totalStudyTimeSeconds - a.totalStudyTimeSeconds);
                setStudyLeaderboard(list);
            } catch (error) {
                console.error("Lỗi tải bảng xếp hạng thời gian học:", error);
            }
        };

        fetchStudyLeaderboard();
        const interval = setInterval(fetchStudyLeaderboard, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let countdown = null;
        if (isTimerRunning && remainingTimerSeconds > 0 && !isIdle) {
            countdown = setInterval(() => {
                setRemainingTimerSeconds((prev) => {
                    if (prev <= 1) {
                        setIsTimerRunning(false);
                        showToast("⏰ Đã hết thời gian học theo hẹn giờ! Tuyệt vời lắm! 🎉", "success");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(countdown);
    }, [isTimerRunning, remainingTimerSeconds, isIdle]);

    const handleStartTimer = () => {
        if (targetMinutes <= 0) return;
        setRemainingTimerSeconds(targetMinutes * 60);
        setIsTimerRunning(true);
    };

    const handlePauseTimer = () => {
        setIsTimerRunning(false);
    };

    const handleResetTimer = () => {
        setIsTimerRunning(false);
        setRemainingTimerSeconds(targetMinutes * 60);
    };

    const saveStudyTimeSession = async () => {
        if (!user) return;
        const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (durationSeconds < 5 || isIdle) return;

        const todayStr = new Date().toISOString().split("T")[0];

        try {
            await addDoc(collection(db, "users", user.uid, "study_sessions"), {
                durationSeconds: durationSeconds,
                date: todayStr,
                createdAt: serverTimestamp(),
            });

            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                totalStudyTimeSeconds: increment(durationSeconds)
            }, { merge: true });
        } catch (error) {
            console.error("Lỗi lưu thời gian học:", error);
        }
    };

    const fetchStudyTimeData = async (uid) => {
        try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.totalStudyTimeSeconds) {
                    setTotalStudyTime(data.totalStudyTimeSeconds);
                }
            }

            const sessionsQuery = query(
                collection(db, "users", uid, "study_sessions"),
                orderBy("createdAt", "desc"),
                limit(50)
            );
            const querySnapshot = await getDocs(sessionsQuery);
            const sessionsMap = {};

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const dateKey = data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split("T")[0] : "Hôm nay");
                if (!sessionsMap[dateKey]) {
                    sessionsMap[dateKey] = 0;
                }
                sessionsMap[dateKey] += (data.durationSeconds || 0);
            });

            const formattedHistory = Object.keys(sessionsMap).map((date) => ({
                date,
                totalSeconds: sessionsMap[date]
            }));

            setDailyHistory(formattedHistory);
        } catch (error) {
            console.error("Lỗi tải dữ liệu thời gian học:", error);
        }
    };

    const handleOpenCheerModal = (targetUser) => {
        if (targetUser.uid === user.uid) {
            showToast("Bạn không thể tự gửi lời động viên cho chính mình nhé! 😄", "error");
            return;
        }
        setSelectedUserForCheer(targetUser);
        setCheerMessage("Cố gắng lên nhé! Chúc bạn học tập thật hiệu quả! 🔥");
        setIsCheerModalOpen(true);
    };

    const handleSendCheer = async (e) => {
        e.preventDefault();
        if (!selectedUserForCheer || !cheerMessage.trim()) return;

        setSendingCheer(true);
        try {
            await addDoc(collection(db, "users", selectedUserForCheer.uid, "cheers"), {
                senderName: currentUserName || user.displayName || user.email || "Học viên ẩn danh",
                senderUid: user.uid,
                message: cheerMessage.trim(),
                createdAt: serverTimestamp(),
            });

            showToast(`❤️ Đã gửi lời động viên thành công đến ${selectedUserForCheer.displayName || selectedUserForCheer.email}!`, "success");
            setIsCheerModalOpen(false);
            setCheerMessage("");
            setSelectedUserForCheer(null);
        } catch (error) {
            console.error("Lỗi gửi lời động viên:", error);
            showToast("Có lỗi xảy ra khi gửi. Vui lòng thử lại.", "error");
        } finally {
            setSendingCheer(false);
        }
    };

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
        fetchStudyTimeData(user.uid);
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
            showToast(`Lỗi tra cứu: ${error.message}`, "error");
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

            showToast("Đóng góp từ vựng thành công! 🎉", "success");
            setNewVocabWord("");
            setNewVocabDef("");
            setShowAddVocabModal(false);
        } catch (error) {
            console.error("Lỗi đóng góp từ vựng:", error);
            showToast("Có lỗi xảy ra khi đóng góp.", "error");
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
            showToast("Cập nhật hồ sơ thành công! ✨", "success");
        } catch (error) {
            setProfileMessage({ text: error.message || "Có lỗi xảy ra, vui lòng thử lại.", type: "error" });
            showToast(error.message || "Có lỗi xảy ra", "error");
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
            showToast("Đã cập nhật môn học thành công!", "success");

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
            showToast("Đã tạo môn học mới thành công!", "success");

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
        showToast("Đã xóa môn học.", "success");

        try {
            await deleteDoc(doc(db, "subjects", subId));
        } catch (error) {
            console.error("Lỗi khi xóa môn học:", error);
            fetchCustomSubjectsFromDB();
        }
    };

    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours} giờ ${minutes} phút`;
        }
        if (minutes > 0) {
            return `${minutes} phút ${seconds} giây`;
        }
        return `${seconds} giây`;
    };

    const formatTimerClock = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
            {/* --- TOAST NOTIFICATION --- */}
            {toast.show && (
                <div className="fixed top-6 right-6 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-bounce">
                    <span className="text-lg">{toast.type === "success" ? "🎉" : "⚠️"}</span>
                    <p className="text-xs font-bold text-white tracking-wide">{toast.message}</p>
                </div>
            )}

            {/* Cảnh báo treo máy */}
            {isIdle && (
                <div className="bg-amber-500 text-slate-950 px-4 py-2 text-center text-xs font-bold sticky top-0 z-40 flex items-center justify-center space-x-2 shadow-lg animate-pulse">
                    <span>⚠️ Hệ thống đã tạm dừng đếm giờ do bạn không tương tác quá 5 phút. Hãy di chuyển chuột hoặc nhấn phím để tiếp tục học!</span>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-2xl">
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
                        <div className="hidden lg:flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300 shadow-inner">
                            <span className={`w-2 h-2 rounded-full ${isIdle ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`}></span>
                            <span>Phiên hiện tại:</span>
                            <strong className="text-white">{formatTime(sessionSeconds)}</strong>
                            {isIdle && <span className="text-amber-400 font-bold">(Tạm dừng)</span>}
                        </div>

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
                {/* Banner Tổng Quan Thời Gian Học */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/45 via-slate-900 to-slate-900/90 border border-slate-800/80 p-8 md:p-12 shadow-2xl mb-10 backdrop-blur-xl">
                    <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute right-40 -bottom-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="max-w-xl">
                            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-5 shadow-inner">
                                <span className={`w-2 h-2 rounded-full ${isIdle ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`}></span>
                                <span>Tổng thời gian học: <strong>{formatTime(totalStudyTime + sessionSeconds)}</strong></span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-white">
                                Xin chào, <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{currentUserName || "Học viên"}</span>! ✨
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
                                Theo dõi thời gian tập trung và quản lý tiến độ học tập mỗi ngày hiệu quả hơn ngay tại đây.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleOpenCreateModal}
                                className="whitespace-nowrap px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2 border border-indigo-400/20"
                            >
                                <span className="text-lg">＋</span>
                                <span>Tạo môn học mới</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hộp thông báo Lời động viên nhận được gần đây (Có nút Xem tất cả) */}
                {incomingCheers.length > 0 && (
                    <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-indigo-950/40 border border-rose-500/30 shadow-xl backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                                <span>💖</span> Lời Động Viên / Thả Tim Nhận Được ({incomingCheers.length})
                            </h3>
                            {incomingCheers.length > 3 && (
                                <button
                                    onClick={() => setIsAllCheersModalOpen(true)}
                                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition underline underline-offset-4"
                                >
                                    Xem tất cả →
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {incomingCheers.slice(0, 3).map((item) => (
                                <div key={item.id} className="p-4 rounded-2xl bg-slate-950/85 border border-rose-500/20 shadow-inner flex flex-col justify-between">
                                    <p className="text-xs text-slate-200 italic mb-3">"{item.message}"</p>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                                        <span className="font-bold text-rose-300">❤️ {item.senderName}</span>
                                        <span>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString("vi-VN", {hour: '2-digit', minute:'2-digit'}) : "Vừa xong"}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Thanh Chuyển Đổi Tab */}
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
                        onClick={() => setActiveTab("studyTime")}
                        className={`px-5 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 whitespace-nowrap flex items-center space-x-2 ${
                            activeTab === "studyTime"
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30"
                                : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                    >
                        <span>⏱️</span>
                        <span>Thời gian học & Hẹn giờ</span>
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
                        <span>Tra cứu chung</span>
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

                {/* TAB: THỜI GIAN HỌC, HẸN GIỜ, ONLINE & BẢNG XẾP HẠNG */}
                {activeTab === "studyTime" && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                                            <span>⏳</span> Hẹn Giờ Học Tập (Pomodoro)
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-6">
                                        Chọn thời gian bạn muốn tập trung học tập không xao nhãng. Hệ thống sẽ đếm ngược và thông báo cho bạn khi hoàn thành.
                                    </p>

                                    <div className="text-center py-8 bg-slate-950/60 rounded-3xl border border-slate-800 mb-6 shadow-inner">
                                        <div className="text-5xl md:text-6xl font-black text-emerald-400 tracking-wider mb-2 font-mono">
                                            {formatTimerClock(remainingTimerSeconds)}
                                        </div>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                                            {isTimerRunning ? (isIdle ? "Đã tạm dừng (Do treo máy)" : "Đang đếm ngược...") : "Đã tạm dừng / Đã sẵn sàng"}
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                                Đặt thời gian học (Phút)
                                            </label>
                                            <div className="flex gap-2">
                                                {[15, 25, 45, 60].map((mins) => (
                                                    <button
                                                        key={mins}
                                                        onClick={() => {
                                                            setTargetMinutes(mins);
                                                            setRemainingTimerSeconds(mins * 60);
                                                            setIsTimerRunning(false);
                                                        }}
                                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                                                            targetMinutes === mins
                                                                ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                                                                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
                                                        }`}
                                                    >
                                                        {mins} phút
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3 pt-8 mt-6 border-t border-slate-800">
                                    {!isTimerRunning ? (
                                        <button
                                            onClick={handleStartTimer}
                                            className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition active:scale-95 border border-emerald-400/20"
                                        >
                                            Bắt đầu đếm giờ 🚀
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handlePauseTimer}
                                            className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition active:scale-95 border border-amber-400/20"
                                        >
                                            Tạm dừng ⏸️
                                        </button>
                                    )}
                                    <button
                                        onClick={handleResetTimer}
                                        className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition border border-slate-700"
                                    >
                                        Đặt lại 🔄
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                                            <span>📅</span> Lịch Sử Thời Gian Học
                                        </h3>
                                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                                            Tổng: {formatTime(totalStudyTime)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-6">
                                        Thống kê thời lượng tập trung học tập tích lũy của bạn qua từng ngày.
                                    </p>

                                    {dailyHistory.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                            <span className="text-4xl mb-2 block opacity-70">📉</span>
                                            <h4 className="text-sm font-bold text-slate-200">Chưa có lịch sử học tập</h4>
                                            <p className="text-xs text-slate-400 mt-1">Hãy bắt đầu học trên Dashboard để ghi nhận thời gian.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                            {dailyHistory.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                                                            🗓️
                                                        </span>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-white">Ngày: {item.date}</h4>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">Đã hoàn thành phiên học</p>
                                                        </div>
                                                    </div>
                                                    <span className="px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-300 font-extrabold text-xs border border-indigo-500/20">
                                                        {formatTime(item.totalSeconds)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    <span>🟢</span> Thành Viên Đang Online & Tương Tác ({onlineUsers.length})
                                </h3>
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Trực tiếp thời gian thực
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-6">
                                Danh sách các học viên đang online. Bạn có thể bấm Thả Tim hoặc Gửi Lời Động Viên để khích lệ tinh thần học tập của họ!
                            </p>

                            {onlineUsers.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                    <span className="text-3xl mb-2 block opacity-70">👥</span>
                                    <h4 className="text-sm font-bold text-slate-200">Hiện tại chỉ có mình bạn đang online</h4>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {onlineUsers.map((u) => {
                                        const isMe = u.uid === user.uid;
                                        return (
                                            <div key={u.id} className="flex flex-col justify-between p-4 rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner space-y-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : "👤"}
                                                        </div>
                                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950"></span>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <h4 className="text-xs font-bold text-white truncate">
                                                            {u.displayName || u.email} {isMe && <span className="text-indigo-400">(Bạn)</span>}
                                                        </h4>
                                                        <p className="text-[10px] text-emerald-400 font-medium mt-0.5">Đang trực tuyến</p>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-800/80">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Đang học:</span>
                                                    <span className="text-xs font-semibold text-indigo-300 truncate block mt-0.5">
                                                        📚 {u.currentSubject || "Tổng quan Dashboard"}
                                                    </span>
                                                </div>

                                                {!isMe && (
                                                    <button
                                                        onClick={() => handleOpenCheerModal(u)}
                                                        className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-bold transition border border-rose-500/20 flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
                                                    >
                                                        <span>❤️</span>
                                                        <span>Thả tim & Động viên</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/80 rounded-3xl p-8 shadow-2xl border border-slate-800/80 backdrop-blur-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    <span>🏆</span> Bảng Xếp Hạng Thời Gian Học Tập
                                </h3>
                                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
                                    Top học viên chăm chỉ
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-6">
                                Xếp hạng tổng thời gian tập trung ôn tập của các học viên trên toàn hệ thống.
                            </p>

                            {studyLeaderboard.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                    <span className="text-3xl mb-2 block opacity-70">🏅</span>
                                    <h4 className="text-sm font-bold text-slate-200">Chưa có dữ liệu bảng xếp hạng</h4>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {studyLeaderboard.map((item, index) => {
                                        const isMe = item.uid === user.uid;
                                        const rank = index + 1;
                                        let rankBadge = "bg-slate-800 text-slate-300 border-slate-700";
                                        if (rank === 1) rankBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40 font-black shadow-lg shadow-amber-500/10";
                                        else if (rank === 2) rankBadge = "bg-slate-300/20 text-slate-200 border-slate-300/40 font-bold";
                                        else if (rank === 3) rankBadge = "bg-amber-700/20 text-amber-500 border-amber-700/40 font-bold";

                                        const onlineInfo = onlineUsers.find(u => u.uid === item.uid);

                                        return (
                                            <div
                                                key={item.uid}
                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                                    isMe
                                                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-md"
                                                        : "bg-slate-950/60 border-slate-800"
                                                }`}
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs border ${rankBadge}`}>
                                                        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                            {item.displayName ? item.displayName.charAt(0).toUpperCase() : "👤"}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                                                {item.displayName} {isMe && <span className="text-indigo-400 font-extrabold">(Bạn)</span>}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                Đang học: <span className="text-indigo-300 font-semibold">{onlineInfo ? onlineInfo.currentSubject : "Đang ngoại tuyến"}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right flex items-center space-x-3">
                                                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-black text-xs border border-emerald-500/20 shadow-inner">
                                                        {formatTime(item.totalStudyTimeSeconds)}
                                                    </span>
                                                    {!isMe && (
                                                        <button
                                                            onClick={() => handleOpenCheerModal({ uid: item.uid, displayName: item.displayName })}
                                                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition border border-rose-500/20 text-xs"
                                                            title="Gửi tim & động viên"
                                                        >
                                                            ❤️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: TRA CỨU CHUNG TOÀN HỆ THỐNG */}
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
                                placeholder="Nhập từ vựng hoặc cấu trúc cần tìm..."
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
                            </div>
                        ) : (
                            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                                <span className="text-4xl mb-2 block opacity-70">💡</span>
                                <h4 className="text-sm font-bold text-slate-200">Bắt đầu tra cứu</h4>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: NGÔI ĐỀN DANH VỌNG */}
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

                {/* TAB: HỒ SƠ CÁ NHÂN */}
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

            {/* --- MODAL XEM TẤT CẢ LỜI ĐỘNG VIÊN --- */}
            {isAllCheersModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-fadeIn">
                    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                                    <span>💖</span> Tất Cả Lời Động Viên & Thả Tim ({incomingCheers.length})
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Danh sách toàn bộ thông điệp khích lệ từ cộng đồng.</p>
                            </div>
                            <button
                                onClick={() => setIsAllCheersModalOpen(false)}
                                className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {incomingCheers.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">Chưa có lời động viên nào.</div>
                            ) : (
                                incomingCheers.map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-slate-950/85 border border-rose-500/20 shadow-inner flex flex-col justify-between">
                                        <p className="text-xs md:text-sm text-slate-200 italic mb-3">"{item.message}"</p>
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                                            <span className="font-bold text-rose-300">❤️ {item.senderName}</span>
                                            <span>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString("vi-VN") : "Vừa xong"}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800 text-right">
                            <button
                                onClick={() => setIsAllCheersModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Gửi Lời Động Viên / Thả Tim */}
            {isCheerModalOpen && selectedUserForCheer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-fadeIn">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span>❤️</span> Gửi Lời Động Viên
                            </h3>
                            <button
                                onClick={() => setIsCheerModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 mb-4">
                            Đang gửi đến học viên: <strong className="text-white">{selectedUserForCheer.displayName || selectedUserForCheer.email}</strong>
                        </p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {[
                                "Cố gắng lên nhé! 🔥",
                                "Tuyệt vời quá, tiếp tục phát huy nhé! 🌟",
                                "Chăm chỉ thế! Chúc bạn học tốt nha! 📚",
                                "Đừng bỏ cuộc, bạn sắp thành công rồi! 💪"
                            ].map((presetMsg, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCheerMessage(presetMsg)}
                                    className="text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded-xl border border-slate-700 transition"
                                >
                                    {presetMsg}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSendCheer} className="space-y-4 text-sm">
                            <div>
                                <textarea
                                    required
                                    rows={3}
                                    value={cheerMessage}
                                    onChange={(e) => setCheerMessage(e.target.value)}
                                    placeholder="Nhập lời động viên của bạn..."
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white placeholder-slate-500 shadow-inner focus:border-rose-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCheerModalOpen(false)}
                                    className="w-1/2 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingCheer}
                                    className="w-1/2 rounded-2xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50 border border-rose-400/20"
                                >
                                    {sendingCheer ? "Đang gửi..." : "Gửi Tim ❤️"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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