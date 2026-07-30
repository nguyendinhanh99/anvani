"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/src/context/AuthContext";

export default function GameHubPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params?.subjectId;
  const { user } = useAuth();

  const [selectedGame, setSelectedGame] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hàm lưu điểm số lên Firebase Firestore
  const saveScoreToDatabase = async (gameName, score, total) => {
    if (!user || !subjectId) return;
    try {
      await addDoc(collection(db, "scores"), {
        userId: user.uid,
        userEmail: user.email || "",
        subjectId: subjectId,
        gameName: gameName, // "Trắc Nghiệm Tốc Độ" hoặc "Nối Từ Tương Ứng"
        score: score,
        total: total,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Lỗi lưu điểm:", error);
    }
  };

  useEffect(() => {
    if (!subjectId) return;

    const fetchSubjectData = async () => {
      try {
        const lessonsRef = collection(db, "subjects", subjectId, "lessons");
        const querySnapshot = await getDocs(lessonsRef);
        
        let allVocabs = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const items = data.vocabularies || data.words || [];
          const formatted = items.map((item, idx) => ({
            id: docSnap.id + "-" + idx,
            term: item.term || item.word || item.q || "",
            meaning: item.meaning || item.definition || item.a || "",
          })).filter(item => item.term && item.meaning);

          allVocabs = [...allVocabs, ...formatted];
        });

        setVocabList(allVocabs);
      } catch (error) {
        console.error("Lỗi tải dữ liệu game:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjectData();
  }, [subjectId]);

  const gameList = [
    {
      id: "flashcard",
      title: "Flashcard Lật Thẻ 3D",
      description: "Ghi nhớ từ vựng sâu hơn qua không gian lật thẻ trực quan.",
      icon: "🎴",
      gradient: "from-violet-600 to-indigo-600",
      shadow: "shadow-indigo-500/25",
      badge: "Phổ biến nhất"
    },
    {
      id: "quiz",
      title: "Trắc Nghiệm Tốc Độ",
      description: "Thử thách phản xạ với các câu hỏi 4 đáp án thông minh.",
      icon: "⚡",
      gradient: "from-blue-600 to-cyan-500",
      shadow: "shadow-cyan-500/25",
      badge: "Thử thách"
    },
    {
      id: "matching",
      title: "Nối Từ Tương Ứng",
      description: "Trò chơi ghép cặp từ vựng và nghĩa chính xác.",
      icon: "🧩",
      gradient: "from-emerald-600 to-teal-500",
      shadow: "shadow-emerald-500/25",
      badge: "Trí tuệ"
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400 tracking-wide animate-pulse">Đang đồng bộ kho game...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <button
          onClick={() => {
            if (selectedGame) setSelectedGame(null);
            else router.push(`/subjects/${subjectId}`);
          }}
          className="mb-8 inline-flex items-center text-sm font-semibold text-slate-400 hover:text-white transition-all bg-slate-900/80 hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-sm backdrop-blur-md group"
        >
          <span className="group-hover:-translate-x-1 transition-transform mr-2">←</span> 
          {selectedGame ? "Quay lại danh sách game" : "Quay lại môn học"}
        </button>

        {!selectedGame && (
          <div className="animate-fadeIn">
            <div className="mb-10 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-wider uppercase mb-4 border border-indigo-500/20 shadow-inner">
                <span>🎮</span> Gamification Hub
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Kho Game Ôn Tập</h2>
              <p className="text-slate-400 mt-2 text-sm md:text-base">Nâng cao hiệu suất ghi nhớ từ vựng thông qua các phương pháp tương tác cao.</p>
            </div>

            {vocabList.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-dashed border-slate-800 shadow-2xl p-8">
                <span className="text-6xl mb-4 block animate-bounce">📭</span>
                <h3 className="text-lg font-bold text-white">Chưa có từ vựng nào</h3>
                <p className="text-sm text-slate-400 mt-1 mb-6">Vui lòng thêm bài học và từ vựng trước khi bắt đầu trải nghiệm game.</p>
                <button
                  onClick={() => router.push(`/subjects/${subjectId}`)}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 hover:scale-105 transition-all"
                >
                  Thêm bài học ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {gameList.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className="group relative bg-slate-900/60 backdrop-blur-xl rounded-3xl p-7 border border-slate-800/80 shadow-xl hover:shadow-2xl hover:border-indigo-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-2 overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${game.gradient} flex items-center justify-center text-2xl text-white shadow-lg ${game.shadow} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                          {game.icon}
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {game.badge}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {game.title}
                      </h3>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        {game.description}
                      </p>
                    </div>

                    <div className="mt-8 flex items-center text-sm font-semibold text-indigo-400 group-hover:text-indigo-300">
                      <span>Bắt đầu chơi</span>
                      <span className="ml-1.5 group-hover:translate-x-1.5 transition-transform">→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedGame === "flashcard" && <FlashcardGame vocabList={vocabList} />}
        {selectedGame === "quiz" && <QuizGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
        {selectedGame === "matching" && <MatchingGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
      </div>
    </main>
  );
}

// 1. FLASHCARD GAME
function FlashcardGame({ vocabList }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const currentItem = vocabList[currentIndex];

  const handleNext = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % vocabList.length);
    }, 200);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + vocabList.length) % vocabList.length);
    }, 200);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 border border-slate-800 shadow-2xl text-center animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">🎴</span> Flashcard Ôn Tập
        </h3>
        <span className="px-3.5 py-1.5 bg-slate-800 rounded-full text-xs font-bold text-slate-300 border border-slate-700">
          Thẻ {currentIndex + 1} / {vocabList.length}
        </span>
      </div>

      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="relative w-full h-80 sm:h-96 cursor-pointer group perspective-1000 my-4"
      >
        <div className={`w-full h-full rounded-3xl transition-all duration-500 transform-style-3d shadow-2xl border border-slate-700/60 flex flex-col items-center justify-center p-8 bg-gradient-to-br ${isFlipped ? "from-indigo-950 via-slate-900 to-purple-950 text-indigo-200 border-indigo-500/30" : "from-slate-900 via-slate-900 to-slate-800 text-white"}`}>
          <span className="absolute top-5 right-6 text-[11px] uppercase font-bold tracking-widest text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full">
            {isFlipped ? "Nghĩa tiếng Việt" : "Từ vựng gốc"}
          </span>
          <h4 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 drop-shadow-md">
            {isFlipped ? currentItem.meaning : currentItem.term}
          </h4>
          <p className="text-xs text-slate-400 mt-6 tracking-wide bg-white/5 px-4 py-2 rounded-full border border-white/5">
            {isFlipped ? "✨ Chạm để lật về từ vựng" : "✨ Chạm vào thẻ để lật xem nghĩa"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={handlePrev}
          className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-300 transition-all active:scale-95 border border-slate-700"
        >
          ← Thẻ trước
        </button>
        <button
          onClick={handleNext}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
        >
          Thẻ tiếp theo →
        </button>
      </div>
    </div>
  );
}

// 2. QUIZ GAME (Trắc nghiệm nhanh + Tự động lưu điểm)
function QuizGame({ vocabList, saveScore }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const shuffled = [...vocabList].sort(() => 0.5 - Math.random());
    const generated = shuffled.map((item) => {
      const wrongOptions = vocabList
        .filter((v) => v.id !== item.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((v) => v.meaning);

      const options = [...wrongOptions, item.meaning].sort(() => 0.5 - Math.random());
      return {
        term: item.term,
        correct: item.meaning,
        options,
      };
    });
    setQuestions(generated);
  }, [vocabList]);

  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];

  const handleSelect = (option) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    if (option === currentQ.correct) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      // Lưu điểm khi kết thúc bài quiz
      saveScore("Trắc Nghiệm Tốc Độ", score + (selectedOption === currentQ.correct ? 1 : 0), questions.length);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsFinished(false);
  };

  if (isFinished) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-slate-800 text-center animate-fadeIn">
        <span className="text-6xl mb-4 block animate-bounce">🏆</span>
        <h3 className="text-3xl font-black text-white mb-2">Hoàn thành thử thách!</h3>
        <p className="text-slate-400 mb-8 text-lg">Bạn đã trả lời chính xác <strong className="text-emerald-400 font-extrabold text-2xl">{score}</strong> / {questions.length} câu hỏi.</p>
        <button
          onClick={restartQuiz}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-xl shadow-indigo-600/30 hover:scale-105 transition-all"
        >
          Chơi lại từ đầu 🔄
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-800 animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-500/10 text-cyan-400">⚡</span> Trắc Nghiệm Tốc Độ
        </h3>
        <span className="px-3.5 py-1.5 bg-cyan-500/15 text-cyan-400 rounded-full text-xs font-bold border border-cyan-500/20">
          Câu {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="p-8 bg-slate-950/60 rounded-3xl border border-slate-800/80 text-center mb-8 shadow-inner">
        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">Nghĩa của từ:</span>
        <h4 className="text-3xl sm:text-4xl font-black text-white mt-3 tracking-tight">{currentQ.term}</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {currentQ.options.map((opt, idx) => {
          let btnStyle = "bg-slate-800/80 border-slate-700/80 text-slate-200 hover:border-indigo-500 hover:bg-slate-800";
          if (selectedOption !== null) {
            if (opt === currentQ.correct) {
              btnStyle = "bg-emerald-600/90 border-emerald-500 text-white shadow-lg shadow-emerald-600/30 animate-pulse";
            } else if (opt === selectedOption) {
              btnStyle = "bg-rose-600/90 border-rose-500 text-white shadow-lg shadow-rose-600/30";
            } else {
              btnStyle = "bg-slate-900/40 border-slate-800 text-slate-600 opacity-40";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(opt)}
              disabled={selectedOption !== null}
              className={`p-5 rounded-2xl border-2 font-semibold text-left transition-all text-base ${btnStyle}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selectedOption !== null && (
        <div className="flex justify-end animate-fadeIn">
          <button
            onClick={handleNextQuestion}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-600/30 hover:scale-105 transition-all"
          >
            {currentIndex + 1 < questions.length ? "Câu tiếp theo →" : "Xem kết quả 🏆"}
          </button>
        </div>
      )}
    </div>
  );
}

// 3. MATCHING GAME (Nối từ tương ứng + Tự động lưu điểm)
function MatchingGame({ vocabList, saveScore }) {
  const [items, setItems] = useState({ terms: [], meanings: [] });
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [isWon, setIsWon] = useState(false);

  useEffect(() => {
    initGame();
  }, [vocabList]);

  const initGame = () => {
    if (!vocabList || vocabList.length === 0) return;
    
    const sample = [...vocabList].sort(() => 0.5 - Math.random()).slice(0, 5);
    
    const terms = sample.map((s) => ({ id: s.id, text: s.term, type: "term" }));
    const meanings = sample.map((s) => ({ id: s.id, text: s.meaning, type: "meaning" }));

    setItems({
      terms: terms.sort(() => 0.5 - Math.random()),
      meanings: meanings.sort(() => 0.5 - Math.random()),
    });
    setSelectedTerm(null);
    setMatchedIds([]);
    setIsWon(false);
  };

  const handleSelectTerm = (item) => {
    if (matchedIds.includes(item.id)) return;
    setSelectedTerm(item);
  };

  const handleSelectMeaning = (item) => {
    if (matchedIds.includes(item.id) || !selectedTerm) return;

    if (selectedTerm.id === item.id) {
      const newMatched = [...matchedIds, item.id];
      setMatchedIds(newMatched);
      setSelectedTerm(null);

      if (newMatched.length === items.terms.length) {
        setIsWon(true);
        // Lưu điểm khi hoàn thành nối từ thành công
        saveScore("Nối Từ Tương Ứng", newMatched.length, items.terms.length);
      }
    } else {
      setSelectedTerm(null);
    }
  };

  if (!items.terms || items.terms.length === 0) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-slate-800 text-center">
        <p className="text-slate-400 animate-pulse">Đang chuẩn bị trò chơi...</p>
      </div>
    );
  }

  if (isWon) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-slate-800 text-center animate-fadeIn">
        <span className="text-6xl mb-4 block animate-bounce">🎉</span>
        <h3 className="text-3xl font-black text-white mb-2">Tuyệt vời! Đã nối đúng tất cả</h3>
        <p className="text-slate-400 mb-8 text-lg">Khả năng ghi nhớ từ vựng của bạn xuất sắc.</p>
        <button
          onClick={initGame}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-xl shadow-emerald-600/30 hover:scale-105 transition-all"
        >
          Chơi ván mới 🔄
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-800 animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">🧩</span> Nối Từ Tương Ứng
        </h3>
        <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          Đã ghép: {matchedIds.length} / {items.terms.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3 px-1">Từ vựng</h4>
          {items.terms.map((item) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = selectedTerm?.id === item.id;

            if (isMatched) return null;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectTerm(item)}
                className={`w-full p-4 rounded-2xl font-bold border-2 transition-all shadow-md text-center text-base ${
                  isSelected 
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-105" 
                    : "bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                {item.text}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3 px-1">Ý nghĩa</h4>
          {items.meanings.map((item) => {
            const isMatched = matchedIds.includes(item.id);

            if (isMatched) return null;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectMeaning(item)}
                className="w-full p-4 rounded-2xl font-semibold border-2 border-slate-700/80 bg-slate-800/80 text-slate-200 hover:bg-emerald-950/40 hover:border-emerald-500/50 transition-all shadow-md text-center text-base"
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}