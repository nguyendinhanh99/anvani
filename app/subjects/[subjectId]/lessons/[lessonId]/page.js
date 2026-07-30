"use client";

import { useAuth } from "@/src/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function LessonDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { subjectId, lessonId } = params;

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tab đang xem: "vocabulary" | "structure" | "reading"
  const [activeTab, setActiveTab] = useState("vocabulary");

  // State ẩn/hiện form cho từng tab
  const [showAddVocabForm, setShowAddVocabForm] = useState(false);
  const [showAddStructForm, setShowAddStructForm] = useState(false);
  const [showAddReadingForm, setShowAddReadingForm] = useState(false);

  // State thêm từ vựng mới
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newGender, setNewGender] = useState("der");
  const [newExample, setNewExample] = useState("");

  // State sửa từ vựng
  const [editingVocab, setEditingVocab] = useState(null);

  // State thêm cấu trúc mới (hỗ trợ nhiều ví dụ & ghi chú)
  const [structTitle, setStructTitle] = useState("");
  const [structMeaning, setStructMeaning] = useState("");
  const [structUsage, setStructUsage] = useState("");
  const [structExamples, setStructExamples] = useState([""]);
  const [structNotes, setStructNotes] = useState([""]);

  // State sửa cấu trúc
  const [editingStructure, setEditingStructure] = useState(null);

  // State thêm nhanh ví dụ/note trực tiếp cho từng cấu trúc trên giao diện
  const [quickInlineInput, setQuickInlineInput] = useState({ structId: null, type: null, value: "" });

  // State thêm Bài đọc mới
  const [readingTitle, setReadingTitle] = useState("");
  const [readingBody, setReadingBody] = useState("");
  const [readingNote, setReadingNote] = useState("");
  const [isExtractingFile, setIsExtractingFile] = useState(false);

  // State sửa Bài đọc
  const [editingReading, setEditingReading] = useState(null);

  // State bôi đen text & AI dịch tự động qua API MyMemory (Dùng chung)
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [inputMeaning, setInputMeaning] = useState("");
  const [selectedColor, setSelectedColor] = useState("bg-indigo-500/20 text-indigo-300 border-indigo-500/30");
  const [isTranslating, setIsTranslating] = useState(false);

  // State xem nghĩa khi click vào từ đã highlight (Dùng chung)
  const [activeTooltip, setActiveTooltip] = useState(null);

  // State thông báo lỗi nhẹ hoặc trùng lặp
  const [toastMessage, setToastMessage] = useState("");

  // State quản lý Modal xác nhận xóa đẹp mắt
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchLessonDetail();

    if (!document.getElementById("tesseract-script")) {
      const tesseractScript = document.createElement("script");
      tesseractScript.id = "tesseract-script";
      tesseractScript.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      document.head.appendChild(tesseractScript);
    }

    if (!document.getElementById("pdfjs-script")) {
      const pdfScript = document.createElement("script");
      pdfScript.id = "pdfjs-script";
      pdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      pdfScript.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
      };
      document.head.appendChild(pdfScript);
    }
  }, [user, lessonId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  const fetchLessonDetail = async () => {
    try {
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLesson({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (error) {
      console.error("Lỗi tải bài học:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploadForReading = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsExtractingFile(true);
    showToast("🔍 Đang phân tích tệp, vui lòng đợi...");

    try {
      if (file.type.startsWith("image/")) {
        if (!window.Tesseract) throw new Error("Thư viện Tesseract chưa sẵn sàng.");
        const { data: { text } } = await window.Tesseract.recognize(file, 'vie+eng', {
          logger: m => console.log(m)
        });
        setReadingBody(prev => (prev ? prev + "\n\n" + text.trim() : text.trim()));
        showToast("✨ Trích xuất văn bản từ ảnh thành công!");
      } else if (file.type === "application/pdf") {
        if (!window.pdfjsLib) throw new Error("Thư viện PDF.js chưa sẵn sàng.");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          fullText += pageText + "\n\n";
        }

        setReadingBody(prev => (prev ? prev + "\n\n" + fullText.trim() : fullText.trim()));
        showToast("✨ Trích xuất văn bản từ PDF thành công!");
      } else {
        alert("Định dạng tệp này chưa được hỗ trợ. Vui lòng chọn File Ảnh (PNG, JPG) hoặc PDF!");
      }
    } catch (error) {
      console.error("Lỗi trích xuất tệp:", error);
      showToast("❌ Không thể trích xuất văn bản từ tệp này.");
    } finally {
      setIsExtractingFile(false);
      e.target.value = null;
    }
  };

  const handleAddVocab = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    const trimmedWord = newWord.trim().toLowerCase();
    const currentVocabs = lesson?.vocabularies || [];

    const isDuplicate = currentVocabs.some(item => item.word && item.word.trim().toLowerCase() === trimmedWord);
    if (isDuplicate) {
      showToast(`⚠️ Từ "${newWord}" đã tồn tại trong thư mục từ vựng!`);
      return;
    }

    try {
      const vocabItem = {
        id: Date.now().toString(),
        word: newWord.trim(),
        meaning: newMeaning.trim(),
        gender: newGender,
        example: newExample.trim(),
        status: "Chưa ôn"
      };

      const updatedVocabularies = [...currentVocabs, vocabItem];
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { vocabularies: updatedVocabularies });

      setLesson(prev => ({ ...prev, vocabularies: updatedVocabularies }));
      setNewWord("");
      setNewMeaning("");
      setNewExample("");
      showToast("✨ Đã thêm từ vựng mới thành công!");
    } catch (error) {
      console.error("Lỗi thêm từ vựng:", error);
    }
  };

  const handleUpdateVocab = async (e) => {
    e.preventDefault();
    if (!editingVocab || !editingVocab.word.trim()) return;

    try {
      const updatedVocabularies = lesson.vocabularies.map(item => 
        item.id === editingVocab.id ? editingVocab : item
      );

      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { vocabularies: updatedVocabularies });

      setLesson(prev => ({ ...prev, vocabularies: updatedVocabularies }));
      setEditingVocab(null);
      showToast("✨ Đã cập nhật từ vựng thành công!");
    } catch (error) {
      console.error("Lỗi cập nhật từ vựng:", error);
    }
  };

  const triggerDeleteVocab = (vocabId) => {
    setConfirmModal({
      show: true,
      title: "Xóa từ vựng",
      message: "Bạn có chắc chắn muốn xóa từ vựng này không? Hành động này không thể hoàn tác.",
      onConfirm: () => handleDeleteVocab(vocabId),
    });
  };

  const handleDeleteVocab = async (vocabId) => {
    try {
      const updatedVocabularies = lesson.vocabularies.filter(item => item.id !== vocabId);
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { vocabularies: updatedVocabularies });

      setLesson(prev => ({ ...prev, vocabularies: updatedVocabularies }));
      showToast("🗑️ Đã xóa từ vựng thành công!");
    } catch (error) {
      console.error("Lỗi xóa từ vựng:", error);
    } finally {
      setConfirmModal({ show: false, title: "", message: "", onConfirm: null });
    }
  };

  const handleAddStructure = async (e) => {
    e.preventDefault();
    if (!structTitle.trim()) return;

    const trimmedTitle = structTitle.trim().toLowerCase();
    const currentStructs = lesson?.structures || [];

    const isDuplicate = currentStructs.some(item => item.title && item.title.trim().toLowerCase() === trimmedTitle);
    if (isDuplicate) {
      showToast(`⚠️ Cấu trúc "${structTitle}" đã tồn tại!`);
      return;
    }

    try {
      const structItem = {
        id: Date.now().toString(),
        title: structTitle.trim(),
        meaning: structMeaning.trim(),
        usage: structUsage.trim(),
        examples: structExamples.filter(ex => ex.trim() !== ""),
        notes: structNotes.filter(n => n.trim() !== ""),
        vocabList: []
      };

      const updatedStructures = [...currentStructs, structItem];
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { structures: updatedStructures });

      setLesson(prev => ({ ...prev, structures: updatedStructures }));
      setStructTitle("");
      setStructMeaning("");
      setStructUsage("");
      setStructExamples([""]);
      setStructNotes([""]);
      showToast("✨ Đã thêm cấu trúc thành công!");
    } catch (error) {
      console.error("Lỗi thêm cấu trúc:", error);
    }
  };

  const handleUpdateStructure = async (e) => {
    e.preventDefault();
    if (!editingStructure || !editingStructure.title.trim()) return;

    try {
      const cleanExamples = (editingStructure.examples || []).filter(ex => typeof ex === "string" && ex.trim() !== "");
      const cleanNotes = (editingStructure.notes || []).filter(n => typeof n === "string" && n.trim() !== "");
      
      const payloadToSave = {
        ...editingStructure,
        examples: cleanExamples,
        notes: cleanNotes
      };

      const updatedStructures = lesson.structures.map(item => 
        item.id === payloadToSave.id ? payloadToSave : item
      );

      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { structures: updatedStructures });

      setLesson(prev => ({ ...prev, structures: updatedStructures }));
      setEditingStructure(null);
      showToast("✨ Cập nhật cấu trúc thành công!");
    } catch (error) {
      console.error("Lỗi cập nhật cấu trúc:", error);
    }
  };

  const triggerDeleteStructure = (structId) => {
    setConfirmModal({
      show: true,
      title: "Xóa cấu trúc",
      message: "Bạn có chắc chắn muốn xóa cấu trúc này không?",
      onConfirm: () => handleDeleteStructure(structId),
    });
  };

  const handleDeleteStructure = async (structId) => {
    try {
      const updatedStructures = lesson.structures.filter(item => item.id !== structId);
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { structures: updatedStructures });

      setLesson(prev => ({ ...prev, structures: updatedStructures }));
      showToast("🗑️ Đã xóa cấu trúc thành công!");
    } catch (error) {
      console.error("Lỗi xóa cấu trúc:", error);
    } finally {
      setConfirmModal({ show: false, title: "", message: "", onConfirm: null });
    }
  };

  const handleQuickAddInline = async (structId, type) => {
    const val = quickInlineInput.value.trim();
    if (!val) return;

    try {
      const updatedStructures = lesson.structures.map(item => {
        if (item.id === structId) {
          if (type === "example") {
            const currentExs = item.examples || [];
            if (currentExs.map(e => e.toLowerCase()).includes(val.toLowerCase())) {
              showToast("⚠️ Ví dụ này đã tồn tại!");
              return item;
            }
            return { ...item, examples: [...currentExs, val] };
          } else if (type === "note") {
            const currentNotes = item.notes || [];
            if (currentNotes.map(n => n.toLowerCase()).includes(val.toLowerCase())) {
              showToast("⚠️ Ghi chú này đã tồn tại!");
              return item;
            }
            return { ...item, notes: [...currentNotes, val] };
          }
        }
        return item;
      });

      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { structures: updatedStructures });

      setLesson(prev => ({ ...prev, structures: updatedStructures }));
      setQuickInlineInput({ structId: null, type: null, value: "" });
      showToast("✨ Thêm thành công!");
    } catch (error) {
      console.error("Lỗi thêm nhanh trực tiếp:", error);
    }
  };

  const handleAddReading = async (e) => {
    e.preventDefault();
    if (!readingTitle.trim()) return;

    const trimmedTitle = readingTitle.trim().toLowerCase();
    const currentReadings = lesson?.readings || [];

    const isDuplicate = currentReadings.some(item => item.title && item.title.trim().toLowerCase() === trimmedTitle);
    if (isDuplicate) {
      showToast(`⚠️ Bài đọc "${readingTitle}" đã tồn tại!`);
      return;
    }

    try {
      const readingItem = {
        id: Date.now().toString(),
        title: readingTitle.trim(),
        body: readingBody.trim(),
        notes: readingNote ? [readingNote.trim()] : [],
        vocabList: [],
        createdAt: new Date().toISOString()
      };

      const updatedReadings = [...currentReadings, readingItem];
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { readings: updatedReadings });

      setLesson(prev => ({ ...prev, readings: updatedReadings }));
      setReadingTitle("");
      setReadingBody("");
      setReadingNote("");
      showToast("✨ Đã thêm bài đọc mới thành công!");
    } catch (error) {
      console.error("Lỗi thêm bài đọc:", error);
    }
  };

  const handleUpdateReading = async (e) => {
    e.preventDefault();
    if (!editingReading || !editingReading.title.trim()) return;

    try {
      const updatedReadings = lesson.readings.map(item => 
        item.id === editingReading.id ? editingReading : item
      );

      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { readings: updatedReadings });

      setLesson(prev => ({ ...prev, readings: updatedReadings }));
      setEditingReading(null);
      showToast("✨ Cập nhật bài đọc thành công!");
    } catch (error) {
      console.error("Lỗi cập nhật bài đọc:", error);
    }
  };

  const triggerDeleteReading = (readingId) => {
    setConfirmModal({
      show: true,
      title: "Xóa bài đọc",
      message: "Bạn có chắc chắn muốn xóa bài đọc này không?",
      onConfirm: () => handleDeleteReading(readingId),
    });
  };

  const handleDeleteReading = async (readingId) => {
    try {
      const updatedReadings = lesson.readings.filter(item => item.id !== readingId);
      const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
      await updateDoc(docRef, { readings: updatedReadings });

      setLesson(prev => ({ ...prev, readings: updatedReadings }));
      showToast("🗑️ Đã xóa bài đọc thành công!");
    } catch (error) {
      console.error("Lỗi xóa bài đọc:", error);
    } finally {
      setConfirmModal({ show: false, title: "", message: "", onConfirm: null });
    }
  };

  const handleRemoveHighlight = async (containerId, wordToRemove, type = "reading") => {
    try {
      if (type === "reading") {
        const updatedReadings = lesson.readings.map(item => {
          if (item.id === containerId) {
            const filteredVocabList = (item.vocabList || []).filter(v => {
              const w = typeof v === "string" ? v : v?.word;
              return w && w.toLowerCase() !== wordToRemove.toLowerCase();
            });
            return { ...item, vocabList: filteredVocabList };
          }
          return item;
        });

        const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
        await updateDoc(docRef, { readings: updatedReadings });
        setLesson(prev => ({ ...prev, readings: updatedReadings }));
      } else if (type === "structure") {
        const updatedStructures = lesson.structures.map(item => {
          if (item.id === containerId) {
            const filteredVocabList = (item.vocabList || []).filter(v => {
              const w = typeof v === "string" ? v : v?.word;
              return w && w.toLowerCase() !== wordToRemove.toLowerCase();
            });
            return { ...item, vocabList: filteredVocabList };
          }
          return item;
        });

        const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
        await updateDoc(docRef, { structures: updatedStructures });
        setLesson(prev => ({ ...prev, structures: updatedStructures }));
      }

      setActiveTooltip(null);
      showToast("🗑️ Đã xóa gạch chân!");
    } catch (error) {
      console.error("Lỗi xóa gạch chân:", error);
    }
  };

  const handleMouseUpOnContainer = async (containerId, type = "reading") => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";

    if (selectedText.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectionPopup({
        containerId,
        type,
        text: selectedText,
        top: rect.bottom + window.scrollY + 10,
        left: rect.left + window.scrollX
      });
      
      setInputMeaning("Đang dịch tự động...");
      setIsTranslating(true);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: selectedText }),
        });
        const data = await res.json();

        if (data.meaning) {
          setInputMeaning(data.meaning);
        } else {
          setInputMeaning("");
        }
      } catch (error) {
        console.error("Lỗi khi gọi API dịch:", error);
        setInputMeaning("");
      } finally {
        setIsTranslating(false);
      }
    } else {
      setSelectionPopup(null);
    }
  };

  const renderInteractiveBody = (containerId, body, rawVocabList, type = "reading") => {
    if (!rawVocabList || !Array.isArray(rawVocabList) || rawVocabList.length === 0 || !body) return body;

    const normalizedVocabs = rawVocabList
      .map((item) => {
        if (typeof item === "string") {
          return { word: item, meaning: "", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" };
        }
        if (item && item.word) {
          return item;
        }
        return null;
      })
      .filter(Boolean);

    if (normalizedVocabs.length === 0) return body;

    const sortedVocabs = [...normalizedVocabs].sort((a, b) => (b.word?.length || 0) - (a.word?.length || 0));
    const escapedVocabs = sortedVocabs
      .map(v => v.word ? v.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : '')
      .filter(Boolean);

    if (escapedVocabs.length === 0) return body;

    const regex = new RegExp(`(${escapedVocabs.join('|')})`, 'gi');
    const parts = body.split(regex);

    return parts.map((part, index) => {
      const foundVocab = sortedVocabs.find(v => v.word && v.word.toLowerCase() === part.toLowerCase());
      if (foundVocab) {
        return (
          <mark 
            key={index} 
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.target.getBoundingClientRect();
              setActiveTooltip({
                containerId,
                type,
                word: foundVocab.word,
                meaning: foundVocab.meaning || "Chưa cập nhật nghĩa",
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX
              });
            }}
            className={`${foundVocab.color || 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'} px-2 py-0.5 rounded-lg mx-0.5 font-bold cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border inline-block`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const handleSaveHighlightedVocab = async () => {
    if (!selectionPopup) return;
    const { containerId, type, text } = selectionPopup;
    const trimmedMeaning = inputMeaning.trim();

    const newVocabObj = {
      id: Date.now().toString(),
      word: text,
      meaning: trimmedMeaning,
      color: selectedColor,
      gender: "none",
      example: "",
      status: "Chưa ôn"
    };

    const currentVocabs = lesson?.vocabularies || [];
    const isVocabExist = currentVocabs.some(v => v.word && v.word.toLowerCase() === text.toLowerCase());
    const updatedVocabList = isVocabExist ? currentVocabs : [...currentVocabs, newVocabObj];

    if (type === "reading") {
      const updatedReadings = lesson.readings.map((item) => {
        if (item.id === containerId) {
          const rawList = item.vocabList || [];
          const filtered = rawList.filter(v => {
            const w = typeof v === "string" ? v : v?.word;
            return w && w.toLowerCase() !== text.toLowerCase();
          });
          return { ...item, vocabList: [...filtered, newVocabObj] };
        }
        return item;
      });

      try {
        const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
        await updateDoc(docRef, { 
          readings: updatedReadings,
          vocabularies: updatedVocabList
        });

        setLesson(prev => ({
          ...prev,
          readings: updatedReadings,
          vocabularies: updatedVocabList
        }));
        showToast("✨ Đã lưu từ vựng thành công!");
      } catch (error) {
        console.error("Lỗi lưu từ mới từ bài đọc:", error);
      }
    } else if (type === "structure") {
      const updatedStructures = lesson.structures.map((item) => {
        if (item.id === containerId) {
          const rawList = item.vocabList || [];
          const filtered = rawList.filter(v => {
            const w = typeof v === "string" ? v : v?.word;
            return w && w.toLowerCase() !== text.toLowerCase();
          });
          return { ...item, vocabList: [...filtered, newVocabObj] };
        }
        return item;
      });

      try {
        const docRef = doc(db, "subjects", subjectId, "lessons", lessonId);
        await updateDoc(docRef, { 
          structures: updatedStructures,
          vocabularies: updatedVocabList
        });

        setLesson(prev => ({
          ...prev,
          structures: updatedStructures,
          vocabularies: updatedVocabList
        }));
        showToast("✨ Đã lưu từ vựng thành công!");
      } catch (error) {
        console.error("Lỗi lưu từ mới từ cấu trúc:", error);
      }
    }

    setSelectionPopup(null);
    window.getSelection().removeAllRanges();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Đang tải chi tiết bài học...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-24 relative selection:bg-indigo-500 selection:text-white" onClick={() => setActiveTooltip(null)}>
      {/* TOAST THÔNG BÁO NHẸ */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 border border-slate-700/80 flex items-center space-x-2 backdrop-blur-xl">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            onClick={() => router.push(`/subjects/${subjectId}`)}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300 shadow-md">
              <span>←</span>
            </div>
            <span className="font-extrabold text-slate-200 text-sm md:text-base group-hover:text-indigo-400 transition-colors">
              Quay lại môn học
            </span>
          </div>

          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-inner">
            <span>Chủ đề: {lesson?.title}</span>
          </div>
        </div>
      </header>

      {/* MODAL XÁC NHẬN XÓA */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-sm w-full shadow-2xl space-y-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-2xl font-bold shadow-inner">⚠️</div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-base text-white">{confirmModal.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setConfirmModal({ show: false, title: "", message: "", onConfirm: null })} className="flex-1 py-3 rounded-xl border border-slate-700/80 font-bold text-slate-300 hover:bg-slate-800 transition text-xs">Hủy bỏ</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition shadow-lg shadow-rose-950/50 text-xs">Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP SỬA TỪ VỰNG */}
      {editingVocab && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <h3 className="font-extrabold text-base text-white">Sửa từ vựng</h3>
              <button onClick={() => setEditingVocab(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateVocab} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-400 mb-1.5">Từ mới</label>
                  <input type="text" value={editingVocab.word} onChange={(e) => setEditingVocab({...editingVocab, word: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1.5">Giống</label>
                  <select value={editingVocab.gender || "none"} onChange={(e) => setEditingVocab({...editingVocab, gender: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-2 py-3 font-bold uppercase text-emerald-400 focus:outline-none focus:border-indigo-500">
                    <option value="der">der</option>
                    <option value="die">die</option>
                    <option value="das">das</option>
                    <option value="none">--</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Nghĩa tiếng Việt</label>
                <input type="text" value={editingVocab.meaning} onChange={(e) => setEditingVocab({...editingVocab, meaning: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Câu ví dụ</label>
                <textarea value={editingVocab.example || ""} onChange={(e) => setEditingVocab({...editingVocab, example: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 h-24 font-medium text-white focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setEditingVocab(null)} className="flex-1 py-3 rounded-xl border border-slate-700/80 font-bold text-slate-300 hover:bg-slate-800 transition">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition shadow-lg shadow-indigo-950/50">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP SỬA CẤU TRÚC */}
      {editingStructure && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <h3 className="font-extrabold text-base text-white">Sửa cấu trúc ngữ pháp</h3>
              <button onClick={() => setEditingStructure(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateStructure} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Tên cấu trúc</label>
                <input type="text" value={editingStructure.title} onChange={(e) => setEditingStructure({...editingStructure, title: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Ý nghĩa</label>
                <input type="text" value={editingStructure.meaning} onChange={(e) => setEditingStructure({...editingStructure, meaning: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Cách dùng</label>
                <textarea value={editingStructure.usage} onChange={(e) => setEditingStructure({...editingStructure, usage: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 h-28 font-medium text-white focus:outline-none focus:border-indigo-500 resize-none" />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Các câu ví dụ</label>
                <div className="space-y-2.5">
                  {(editingStructure.examples || [""]).map((ex, idx) => (
                    <div key={idx} className="flex space-x-2">
                      <input type="text" value={ex} onChange={(e) => {
                        const newExs = [...editingStructure.examples];
                        newExs[idx] = e.target.value;
                        setEditingStructure({...editingStructure, examples: newExs});
                      }} className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 font-medium text-white focus:outline-none focus:border-indigo-500" />
                      <button type="button" onClick={() => {
                        const newExs = editingStructure.examples.filter((_, i) => i !== idx);
                        setEditingStructure({...editingStructure, examples: newExs.length ? newExs : [""]});
                      }} className="px-3.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 font-bold">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditingStructure({...editingStructure, examples: [...(editingStructure.examples || []), ""]})} className="text-indigo-400 hover:text-indigo-300 font-bold pt-1 block">+ Thêm ví dụ</button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Ghi chú quan trọng (Notes)</label>
                <div className="space-y-2.5">
                  {(editingStructure.notes || [""]).map((note, idx) => (
                    <div key={idx} className="flex space-x-2">
                      <input type="text" value={note} onChange={(e) => {
                        const newNotes = [...editingStructure.notes];
                        newNotes[idx] = e.target.value;
                        setEditingStructure({...editingStructure, notes: newNotes});
                      }} className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 font-medium text-white focus:outline-none focus:border-indigo-500" />
                      <button type="button" onClick={() => {
                        const newNotes = editingStructure.notes.filter((_, i) => i !== idx);
                        setEditingStructure({...editingStructure, notes: newNotes.length ? newNotes : [""]});
                      }} className="px-3.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 font-bold">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditingStructure({...editingStructure, notes: [...(editingStructure.notes || []), ""]})} className="text-indigo-400 hover:text-indigo-300 font-bold pt-1 block">+ Thêm ghi chú</button>
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setEditingStructure(null)} className="flex-1 py-3 rounded-xl border border-slate-700/80 font-bold text-slate-300 hover:bg-slate-800 transition">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition shadow-lg shadow-amber-950/50">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP SỬA BÀI ĐỌC */}
      {editingReading && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
              <h3 className="font-extrabold text-base text-white">Sửa bài đọc</h3>
              <button onClick={() => setEditingReading(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateReading} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Tiêu đề bài đọc</label>
                <input type="text" value={editingReading.title} onChange={(e) => setEditingReading({...editingReading, title: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Nội dung văn bản</label>
                <textarea value={editingReading.body} onChange={(e) => setEditingReading({...editingReading, body: e.target.value})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 h-44 font-medium text-white focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1.5">Ghi chú (Note)</label>
                <input type="text" value={editingReading.notes?.[0] || ""} onChange={(e) => setEditingReading({...editingReading, notes: [e.target.value]})} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 font-medium text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex space-x-3 pt-3">
                <button type="button" onClick={() => setEditingReading(null)} className="flex-1 py-3 rounded-xl border border-slate-700/80 font-bold text-slate-300 hover:bg-slate-800 transition">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-950/50">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP DỊCH KHI BÔI ĐEN */}
      {selectionPopup && (
        <div style={{ top: `${selectionPopup.top}px`, left: `${selectionPopup.left}px` }} className="absolute z-50 bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-2xl shadow-2xl w-80 space-y-4 text-xs border border-slate-700 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center font-bold border-b border-slate-800 pb-2.5">
            <span className="text-indigo-400 truncate max-w-[220px]">✨ Từ: &quot;{selectionPopup.text}&quot;</span>
            <button onClick={() => setSelectionPopup(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-1.5">
            <label className="block text-slate-400 font-medium">Nghĩa tiếng Việt:</label>
            <input type="text" value={inputMeaning} onChange={(e) => setInputMeaning(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500" autoFocus />
          </div>
          <div className="space-y-2">
            <label className="block text-slate-400 font-medium">Chọn màu đánh dấu:</label>
            <div className="flex items-center space-x-3">
              {[
                { name: "Tím", class: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
                { name: "Xanh lá", class: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                { name: "Xanh dương", class: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                { name: "Hồng", class: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
              ].map((cObj, idx) => (
                <button key={idx} type="button" onClick={() => setSelectedColor(cObj.class)} className={`w-7 h-7 rounded-full border-2 ${cObj.class.split(' ')[0]} ${selectedColor === cObj.class ? 'ring-2 ring-white scale-110' : 'opacity-60'}`} />
              ))}
            </div>
          </div>
          <button onClick={handleSaveHighlightedVocab} disabled={isTranslating} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-950/50">Lưu từ vựng & Đồng bộ</button>
        </div>
      )}

      {/* TOOLTIP XEM NGHĨA KHI CLICK VÀO TỪ */}
      {activeTooltip && (
        <div style={{ top: `${activeTooltip.top}px`, left: `${activeTooltip.left}px` }} className="absolute z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-3 max-w-xs backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
          <div className="font-extrabold text-sm text-indigo-400 border-b border-slate-800 pb-2.5 flex justify-between items-center">
            <span>{activeTooltip.word}</span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-500/20">Đã lưu</span>
          </div>
          <p className="text-slate-300 font-medium">💡 Ý nghĩa: <strong className="text-white text-sm block mt-1">{activeTooltip.meaning}</strong></p>
          <div className="pt-2.5 border-t border-slate-800 flex justify-end">
            <button onClick={() => handleRemoveHighlight(activeTooltip.containerId, activeTooltip.word, activeTooltip.type)} className="text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 rounded-xl hover:bg-rose-500/10 transition text-xs">🗑️ Xóa gạch chân</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pt-10">
        {/* BANNER THÔNG TIN & TABS */}
        <div className="mb-10 bg-gradient-to-br from-indigo-900/30 via-slate-900 to-slate-900/90 border border-slate-800/80 p-8 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-15">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-2">
              <span>Không gian học tập</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{lesson?.title}</h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium mt-1">Hệ thống bài học thông minh & tương tác dịch văn bản tự động.</p>
          </div>

          <div className="flex space-x-1.5 bg-slate-950/80 p-1.5 rounded-2xl w-full md:w-auto border border-slate-800 relative z-15">
            <button onClick={() => setActiveTab("vocabulary")} className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === "vocabulary" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400 hover:text-white"}`}>Từ vựng ({lesson?.vocabularies?.length || 0})</button>
            <button onClick={() => setActiveTab("structure")} className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === "structure" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400 hover:text-white"}`}>Cấu trúc ({lesson?.structures?.length || 0})</button>
            <button onClick={() => setActiveTab("reading")} className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === "reading" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400 hover:text-white"}`}>Bài đọc ({lesson?.readings?.length || 0})</button>
          </div>
        </div>

        {/* TAB 1: TỪ VỰNG */}
        {activeTab === "vocabulary" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4 h-fit sticky top-28">
              <button
                onClick={() => setShowAddVocabForm(!showAddVocabForm)}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/30 transition flex items-center justify-center space-x-2 border border-emerald-400/20"
              >
                <span>{showAddVocabForm ? "✕ Đóng form thêm từ vựng" : "➕ Thêm từ vựng mới"}</span>
              </button>

              {showAddVocabForm && (
                <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                    <span>➕</span>
                    <span>Thêm từ vựng mới</span>
                  </h3>
                  <form onSubmit={handleAddVocab} className="space-y-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Từ mới</label>
                        <input type="text" required value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="ví dụ: Haus" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Giống</label>
                        <select value={newGender} onChange={(e) => setNewGender(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-3 text-xs font-bold uppercase text-emerald-400 focus:outline-none focus:border-indigo-500">
                          <option value="der">der</option>
                          <option value="die">die</option>
                          <option value="das">das</option>
                          <option value="none">--</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nghĩa tiếng Việt</label>
                      <input type="text" value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="ví dụ: Ngôi nhà" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Câu ví dụ</label>
                      <textarea value={newExample} onChange={(e) => setNewExample(e.target.value)} placeholder="Nhập câu ví dụ..." className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white h-24 focus:outline-none focus:border-indigo-500 resize-none" />
                    </div>
                    <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition">Xác nhận thêm từ vựng</button>
                  </form>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📚</span> Thư mục Từ vựng <span className="text-slate-500 font-normal">({lesson?.vocabularies?.length || 0})</span>
              </h3>
              {(!lesson?.vocabularies || lesson.vocabularies.length === 0) ? (
                <div className="bg-slate-900/40 p-16 rounded-3xl border border-dashed border-slate-800 text-center text-slate-400">Chưa có từ vựng nào.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {lesson.vocabularies.map((item, idx) => (
                    <div key={item.id || idx} className="bg-slate-900/80 border border-slate-800/80 p-6 rounded-3xl shadow-xl backdrop-blur-xl flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/50">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-extrabold text-lg text-white">{item.word}</span>
                          {item.gender && item.gender !== "none" && (
                            <span className="text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">{item.gender}</span>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm font-medium">{item.meaning || <span className="italic text-slate-500">Chưa có nghĩa</span>}</p>
                        {item.example && <p className="text-slate-400 text-xs mt-3.5 italic bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60">&quot;{item.example}&quot;</p>}
                      </div>
                      <div className="flex justify-end space-x-3 mt-5 pt-3.5 border-t border-slate-800/80 text-xs font-bold">
                        <button onClick={() => setEditingVocab(item)} className="text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition">Sửa</button>
                        <button onClick={() => triggerDeleteVocab(item.id)} className="text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 transition">Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CẤU TRÚC */}
        {activeTab === "structure" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4 h-fit sticky top-28">
              <button
                onClick={() => setShowAddStructForm(!showAddStructForm)}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm shadow-xl shadow-amber-950/30 transition flex items-center justify-center space-x-2 border border-amber-400/20"
              >
                <span>{showAddStructForm ? "✕ Đóng form thêm cấu trúc" : "➕ Thêm cấu trúc mới"}</span>
              </button>

              {showAddStructForm && (
                <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Thêm cấu trúc ngữ pháp</span>
                  </h3>
                  <form onSubmit={handleAddStructure} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tên cấu trúc</label>
                      <input type="text" required value={structTitle} onChange={(e) => setStructTitle(e.target.value)} placeholder="ví dụ: Nicht nur ... sondern auch" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ý nghĩa</label>
                      <input type="text" value={structMeaning} onChange={(e) => setStructMeaning(e.target.value)} placeholder="Không những ... mà còn" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cách dùng</label>
                      <textarea value={structUsage} onChange={(e) => setStructUsage(e.target.value)} placeholder="Cách sử dụng..." className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white h-24 focus:outline-none focus:border-indigo-500 resize-none" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Các câu ví dụ</label>
                      <div className="space-y-2.5">
                        {structExamples.map((ex, idx) => (
                          <div key={idx} className="flex space-x-2">
                            <input type="text" value={ex} onChange={(e) => {
                              const newExs = [...structExamples];
                              newExs[idx] = e.target.value;
                              setStructExamples(newExs);
                            }} placeholder={`Ví dụ ${idx + 1}...`} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-500" />
                            {structExamples.length > 1 && (
                              <button type="button" onClick={() => setStructExamples(structExamples.filter((_, i) => i !== idx))} className="px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 font-bold text-xs">✕</button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setStructExamples([...structExamples, ""])} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 pt-1 block">+ Thêm ví dụ khác</button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ghi chú quan trọng (Note)</label>
                      <div className="space-y-2.5">
                        {structNotes.map((note, idx) => (
                          <div key={idx} className="flex space-x-2">
                            <input type="text" value={note} onChange={(e) => {
                              const newNotes = [...structNotes];
                              newNotes[idx] = e.target.value;
                              setStructNotes(newNotes);
                            }} placeholder={`Lưu ý quan trọng ${idx + 1}...`} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-500" />
                            {structNotes.length > 1 && (
                              <button type="button" onClick={() => setStructNotes(structNotes.filter((_, i) => i !== idx))} className="px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 font-bold text-xs">✕</button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setStructNotes([...structNotes, ""])} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 pt-1 block">+ Thêm ghi chú khác</button>
                      </div>
                    </div>

                    <button type="submit" className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-950/50 transition">Xác nhận thêm cấu trúc</button>
                  </form>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚡</span> Danh sách cấu trúc <span className="text-slate-500 font-normal">({lesson?.structures?.length || 0})</span>
              </h3>
              {(!lesson?.structures || lesson.structures.length === 0) ? (
                <div className="bg-slate-900/40 p-16 rounded-3xl border border-dashed border-slate-800 text-center text-slate-400">Chưa có cấu trúc ngữ pháp nào.</div>
              ) : (
                <div className="space-y-6">
                  {lesson.structures.map((item, idx) => (
                    <div key={item.id || idx} className="bg-slate-900/80 border border-slate-800/80 p-7 rounded-3xl shadow-xl backdrop-blur-xl space-y-5">
                      <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                        <div>
                          <h4 className="font-extrabold text-xl text-amber-400 mb-1">{item.title}</h4>
                          <p className="text-white text-sm font-bold">{item.meaning}</p>
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-bold">
                          <button onClick={() => setEditingStructure(item)} className="text-indigo-400 hover:text-indigo-300 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition">Sửa</button>
                          <button onClick={() => triggerDeleteStructure(item.id)} className="text-rose-400 hover:text-rose-300 px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 transition">Xóa</button>
                        </div>
                      </div>

                      {item.usage && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Cách dùng:</span>
                          <div onMouseUp={() => handleMouseUpOnContainer(item.id, "structure")} className="p-4.5 bg-slate-950/80 rounded-2xl text-slate-200 leading-relaxed text-sm border border-slate-800/80 select-text cursor-text">
                            {renderInteractiveBody(item.id, item.usage, item.vocabList, "structure")}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ví dụ minh họa:</span>
                          <button onClick={() => setQuickInlineInput({ structId: item.id, type: "example", value: "" })} className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">+ Thêm ví dụ trực tiếp</button>
                        </div>

                        {item.examples && item.examples.length > 0 && (
                          <div className="space-y-2.5 mt-2">
                            {item.examples.map((exText, eIdx) => (
                              <div key={eIdx} onMouseUp={() => handleMouseUpOnContainer(item.id, "structure")} className="p-4 bg-slate-950/80 rounded-2xl text-slate-200 italic leading-relaxed text-sm border border-slate-800/80 select-text cursor-text">
                                {renderInteractiveBody(item.id, exText, item.vocabList, "structure")}
                              </div>
                            ))}
                          </div>
                        )}

                        {quickInlineInput.structId === item.id && quickInlineInput.type === "example" && (
                          <div className="mt-3.5 p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3">
                            <input type="text" autoFocus value={quickInlineInput.value} onChange={(e) => setQuickInlineInput({ ...quickInlineInput, value: e.target.value })} placeholder="Nhập câu ví dụ mới..." className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none" />
                            <div className="flex justify-end space-x-2">
                              <button onClick={() => setQuickInlineInput({ structId: null, type: null, value: "" })} className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 font-bold text-slate-300 text-xs">Hủy</button>
                              <button onClick={() => handleQuickAddInline(item.id, "example")} className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-md">Thêm ngay</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lưu ý quan trọng:</span>
                          <button onClick={() => setQuickInlineInput({ structId: item.id, type: "note", value: "" })} className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">+ Thêm note trực tiếp</button>
                        </div>

                        {item.notes && item.notes.length > 0 && (
                          <div className="space-y-2.5 mt-2">
                            {item.notes.map((noteText, nIdx) => (
                              <div key={nIdx} className="text-xs text-amber-300 bg-amber-950/20 p-4 rounded-2xl border border-amber-500/20 flex items-start space-x-3">
                                <span className="mt-0.5">💡</span>
                                <span className="font-medium leading-relaxed">{noteText}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {quickInlineInput.structId === item.id && quickInlineInput.type === "note" && (
                          <div className="mt-3.5 p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-3">
                            <input type="text" autoFocus value={quickInlineInput.value} onChange={(e) => setQuickInlineInput({ ...quickInlineInput, value: e.target.value })} placeholder="Nhập ghi chú quan trọng mới..." className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none" />
                            <div className="flex justify-end space-x-2">
                              <button onClick={() => setQuickInlineInput({ structId: null, type: null, value: "" })} className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 font-bold text-slate-300 text-xs">Hủy</button>
                              <button onClick={() => handleQuickAddInline(item.id, "note")} className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-md">Thêm ngay</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5 text-xs">
                        <span className="font-bold text-slate-400 mr-1">Từ mới đã lưu:</span>
                        {(!item.vocabList || item.vocabList.length === 0) ? (
                          <span className="text-slate-500 italic">Chưa có từ nào. Hãy bôi đen văn bản phía trên để thêm màu!</span>
                        ) : (
                          item.vocabList.map((vItem, vIdx) => {
                            const w = typeof vItem === "string" ? vItem : vItem?.word;
                            const m = typeof vItem === "object" ? vItem?.meaning : "";
                            const c = typeof vItem === "object" ? vItem?.color : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
                            if (!w) return null;
                            return (
                              <span key={vIdx} className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 border ${c}`}>
                                <span>{w}</span>
                                {m && <span className="opacity-75 font-normal">({m})</span>}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BÀI ĐỌC */}
        {activeTab === "reading" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4 h-fit sticky top-28">
              <button
                onClick={() => setShowAddReadingForm(!showAddReadingForm)}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-950/30 transition flex items-center justify-center space-x-2 border border-blue-400/20"
              >
                <span>{showAddReadingForm ? "✕ Đóng form thêm bài đọc" : "➕ Thêm bài đọc mới"}</span>
              </button>

              {showAddReadingForm && (
                <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                    <span>📖</span>
                    <span>Thêm bài đọc mới</span>
                  </h3>

                  <div className="mb-4 p-4 rounded-2xl bg-blue-950/30 border border-blue-500/20 space-y-2.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-300">Tự động lấy text từ tệp (Ảnh/PDF)</label>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileUploadForReading}
                      disabled={isExtractingFile}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" 
                    />
                    {isExtractingFile && <p className="text-[11px] text-blue-400 font-semibold animate-pulse">⏳ Đang phân tích tệp trên trình duyệt...</p>}
                  </div>

                  <form onSubmit={handleAddReading} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tên bài đọc</label>
                      <input type="text" required value={readingTitle} onChange={(e) => setReadingTitle(e.target.value)} placeholder="Tiêu đề bài đọc..." className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nội dung văn bản</label>
                      <textarea value={readingBody} onChange={(e) => setReadingBody(e.target.value)} placeholder="Nhập hoặc tải file lên để tự động điền nội dung..." className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white h-40 focus:outline-none focus:border-indigo-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ghi chú (Note)</label>
                      <input type="text" value={readingNote} onChange={(e) => setReadingNote(e.target.value)} placeholder="Ghi chú tóm tắt..." className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={isExtractingFile} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-950/50 transition">Xác nhận thêm bài đọc</button>
                  </form>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📖</span> Danh sách bài đọc <span className="text-slate-500 font-normal">({lesson?.readings?.length || 0})</span>
              </h3>
              {(!lesson?.readings || lesson.readings.length === 0) ? (
                <div className="bg-slate-900/40 p-16 rounded-3xl border border-dashed border-slate-800 text-center text-slate-400">Chưa có bài đọc nào.</div>
              ) : (
                <div className="space-y-6">
                  {lesson.readings.map((item, idx) => (
                    <div key={item.id || idx} className="bg-slate-900/80 border border-slate-800/80 p-7 rounded-3xl shadow-xl backdrop-blur-xl space-y-5">
                      <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                        <h4 className="font-extrabold text-xl text-white">{item.title}</h4>
                        <div className="flex items-center space-x-2 text-xs font-bold">
                          <button onClick={() => setEditingReading(item)} className="text-indigo-400 hover:text-indigo-300 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 transition">Sửa</button>
                          <button onClick={() => triggerDeleteReading(item.id)} className="text-rose-400 hover:text-rose-300 px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 transition">Xóa</button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Văn bản tương tác:</span>
                        <div onMouseUp={() => handleMouseUpOnContainer(item.id, "reading")} className="p-6 bg-slate-950/80 rounded-2xl text-slate-200 leading-loose whitespace-pre-line text-sm border border-slate-800/80 select-text cursor-text">
                          {renderInteractiveBody(item.id, item.body, item.vocabList, "reading")}
                        </div>
                      </div>

                      {item.notes && item.notes.length > 0 && (
                        <div className="space-y-2.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Ghi chú quan trọng:</span>
                          {item.notes.map((noteText, nIdx) => (
                            <div key={nIdx} className="text-xs text-indigo-300 bg-indigo-950/30 p-4 rounded-2xl border border-indigo-500/20 flex items-start space-x-3">
                              <span className="mt-0.5">📌</span>
                              <span className="font-medium leading-relaxed">{noteText}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5 text-xs">
                        <span className="font-bold text-slate-400 mr-1">Từ mới đã lưu:</span>
                        {(!item.vocabList || item.vocabList.length === 0) ? (
                          <span className="text-slate-500 italic">Chưa có từ nào.</span>
                        ) : (
                          item.vocabList.map((vItem, vIdx) => {
                            const w = typeof vItem === "string" ? vItem : vItem?.word;
                            const m = typeof vItem === "object" ? vItem?.meaning : "";
                            const c = typeof vItem === "object" ? vItem?.color : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
                            if (!w) return null;
                            return (
                              <span key={vIdx} className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 border ${c}`}>
                                <span>{w}</span>
                                {m && <span className="opacity-75 font-normal">({m})</span>}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}