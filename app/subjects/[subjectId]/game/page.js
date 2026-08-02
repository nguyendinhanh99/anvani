"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/src/context/AuthContext";

// Tiện ích âm thanh dùng chung (Web Audio API)
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "correct") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "wrong") {
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.setValueAtTime(120, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "click") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) { }
};

export default function GameHubPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params?.subjectId;
  const { user } = useAuth();

  const [selectedGame, setSelectedGame] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [loading, setLoading] = useState(true);

  const saveScoreToDatabase = async (gameName, score, total) => {
    if (!user || !subjectId) return;
    try {
      await addDoc(collection(db, "scores"), {
        userId: user.uid,
        userEmail: user.email || "",
        subjectId: subjectId,
        gameName: gameName,
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
      id: "adventure",
      title: "Word Adventure",
      description: "Chạy trốn không gian: Né chướng ngại vật, chọn đúng từ vựng tương ứng tích lũy XP cực cuốn.",
      icon: "🚀",
      gradient: "from-fuchsia-600 via-pink-600 to-rose-600",
      shadow: "shadow-pink-500/30",
      badge: "Siêu phẩm 🌟"
    },
    {
      id: "flashcard",
      title: "Flashcard Lật Thẻ 3D",
      description: "Ghi nhớ từ vựng sâu hơn qua không gian lật thẻ trực quan.",
      icon: "🎴",
      gradient: "from-violet-600 to-indigo-600",
      shadow: "shadow-indigo-500/25",
      badge: "Phổ biến"
    },
    {
      id: "scramble",
      title: "Thợ Săn Từ Vựng",
      description: "Sắp xếp lại các ký tự bị xáo trộn để tạo thành từ tiếng Anh chính xác.",
      icon: "🎯",
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-orange-500/25",
      badge: "Trí tuệ"
    },
    {
      id: "quiz",
      title: "Trắc Nghiệm Tốc Độ",
      description: "Thử thách phản xạ với đếm ngược thời gian và câu hỏi 4 đáp án.",
      icon: "⚡",
      gradient: "from-blue-600 to-cyan-500",
      shadow: "shadow-cyan-500/25",
      badge: "Thử thách"
    },
    {
      id: "matching",
      title: "Nối Từ Tương Ứng",
      description: "Ghép cặp từ vựng và nghĩa chính xác với phản hồi trực quan.",
      icon: "🧩",
      gradient: "from-emerald-600 to-teal-500",
      shadow: "shadow-emerald-500/25",
      badge: "Thư giãn"
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400 tracking-wide animate-pulse">Đang nạp vũ trụ game...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <button
          onClick={() => {
            playSound("click");
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 text-pink-400 text-xs font-bold tracking-wider uppercase mb-4 border border-pink-500/20 shadow-inner">
                <span>🕹️</span> Arcade Gamification Hub
              </div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-pink-400 bg-clip-text text-transparent">
                Kho Game Ôn Tập
              </h2>
              <p className="text-slate-400 mt-2 text-sm md:text-base">Chinh phục từ vựng qua trải nghiệm game tương tác cực đỉnh.</p>
            </div>

            {vocabList.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-dashed border-slate-800 shadow-2xl p-8">
                <span className="text-6xl mb-4 block animate-bounce">📭</span>
                <h3 className="text-lg font-bold text-white">Chưa có từ vựng nào</h3>
                <p className="text-sm text-slate-400 mt-1 mb-6">Vui lòng thêm bài học và từ vựng trước khi bắt đầu trải nghiệm game.</p>
                <button
                  onClick={() => router.push(`/subjects/${subjectId}`)}
                  className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-pink-600/30 hover:scale-105 transition-all"
                >
                  Thêm bài học ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gameList.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => {
                      playSound("click");
                      setSelectedGame(game.id);
                    }}
                    className="group relative bg-slate-900/60 backdrop-blur-xl rounded-3xl p-7 border border-slate-800/80 shadow-xl hover:shadow-2xl hover:border-pink-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-2 overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>

                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${game.gradient} flex items-center justify-center text-2xl text-white shadow-lg ${game.shadow} group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
                          {game.icon}
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-800/90 text-pink-300 border border-pink-500/30 shadow-sm">
                          {game.badge}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-pink-400 transition-colors">
                        {game.title}
                      </h3>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        {game.description}
                      </p>
                    </div>

                    <div className="mt-8 flex items-center text-sm font-semibold text-pink-400 group-hover:text-pink-300">
                      <span>Vào chơi ngay</span>
                      <span className="ml-1.5 group-hover:translate-x-1.5 transition-transform">→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedGame === "adventure" && <WordAdventureGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
        {selectedGame === "flashcard" && <FlashcardGame vocabList={vocabList} />}
        {selectedGame === "scramble" && <WordScrambleGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
        {selectedGame === "quiz" && <QuizGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
        {selectedGame === "matching" && <MatchingGame vocabList={vocabList} saveScore={saveScoreToDatabase} />}
      </div>
    </main>
  );
}

// 0. WORD ADVENTURE GAME (PHÊN BẢN THUẦN ARCADE GAME)
// 0. WORD ADVENTURE GAME (PREMIUM 3D RUNNER ARCADE EDITION - FULL CODE)
function WordAdventureGame({ vocabList, saveScore }) {
  const [rounds, setRounds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [scoreXP, setScoreXP] = useState(0);
  const [coins, setCoins] = useState(56);
  const [combo, setCombo] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [statusAnim, setStatusAnim] = useState(null); // 'correct' | 'wrong'
  const [selectedLaneIndex, setSelectedLaneIndex] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    initGame();
  }, [vocabList]);

  const initGame = () => {
    if (!vocabList || vocabList.length === 0) return;
    const shuffled = [...vocabList].sort(() => 0.5 - Math.random());

    const generatedRounds = shuffled.map((item) => {
      const wrongOpts = vocabList
        .filter(v => v.id !== item.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 2);

      const options = [item, ...wrongOpts].sort(() => 0.5 - Math.random());
      return {
        target: item,
        options: options
      };
    });

    setRounds(generatedRounds);
    setCurrentIndex(0);
    setLives(3);
    setScoreXP(0);
    setCoins(56);
    setCombo(0);
    setIsFinished(false);
    setStatusAnim(null);
    setSelectedLaneIndex(null);
    setIsMoving(false);
  };

  const handleChooseLane = (selectedItem, laneIdx) => {
    if (statusAnim !== null || isFinished) return;
    const currentRound = rounds[currentIndex];
    setSelectedLaneIndex(laneIdx);
    setIsMoving(true);

    if (selectedItem.id === currentRound.target.id) {
      playSound("correct");
      setStatusAnim("correct");
      setScoreXP(prev => prev + 20);
      setCoins(prev => prev + 5);
      setCombo(prev => prev + 1);

      setTimeout(() => {
        setStatusAnim(null);
        setSelectedLaneIndex(null);
        setIsMoving(false);
        if (currentIndex + 1 < rounds.length) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setIsFinished(true);
          saveScore("Word Adventure", scoreXP + 20, rounds.length * 20);
        }
      }, 800);
    } else {
      playSound("wrong");
      setStatusAnim("wrong");
      setCombo(0);
      const newLives = lives - 1;
      setLives(newLives);

      setTimeout(() => {
        setStatusAnim(null);
        setSelectedLaneIndex(null);
        setIsMoving(false);
        if (newLives <= 0) {
          setIsFinished(true);
          saveScore("Word Adventure", scoreXP, rounds.length * 20);
        } else {
          if (currentIndex + 1 < rounds.length) {
            setCurrentIndex(prev => prev + 1);
          } else {
            setIsFinished(true);
            saveScore("Word Adventure", scoreXP, rounds.length * 20);
          }
        }
      }, 800);
    }
  };

  if (rounds.length === 0) return null;

  if (isFinished) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border-2 border-emerald-500/50 text-center animate-fadeIn relative overflow-hidden max-w-md mx-auto">
        <span className="text-7xl mb-4 block animate-bounce">🏆</span>
        <h3 className="text-3xl font-black text-white mb-2 tracking-wider">HOÀN THÀNH CHẶNG ĐUA!</h3>
        <p className="text-slate-300 mb-2">Tổng điểm: <strong className="text-amber-400 font-black text-2xl">+{scoreXP} XP</strong></p>
        <p className="text-slate-300 mb-6">Xu thưởng: <strong className="text-yellow-400 font-black text-2xl">+{coins} 🪙</strong></p>
        <button
          onClick={initGame}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black shadow-xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest border border-white/20"
        >
          Chơi Lại Ván Mới 🚀
        </button>
      </div>
    );
  }

  const currentRound = rounds[currentIndex];
  const progressPercent = ((currentIndex + 1) / rounds.length) * 100;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes roadScroll {
          0% { background-position: 0 0; }
          100% { background-position: 0 100px; }
        }
        .animate-road {
          animation: roadScroll ${isMoving ? '0.2s' : '1s'} linear infinite;
        }
      `}} />

      {/* KHUNG GAME CHUẨN UI/UX CAO CẤP */}
      <div className="relative bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#090d16] rounded-[32px] overflow-hidden shadow-2xl border-[5px] border-cyan-500/40 max-w-md mx-auto flex flex-col h-[740px] select-none">

        {/* ================= HEADER HUD ================= */}
        <div className="absolute top-0 inset-x-0 z-40 flex items-center justify-between p-3.5 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent backdrop-blur-sm">
          {/* Stage & Checkpoint Progress */}
          <div className="flex flex-col bg-slate-900/90 border border-sky-500/40 px-3 py-1.5 rounded-2xl shadow-lg">
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">
              STAGE {currentIndex + 1} / {rounds.length}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs">👦🏽</span>
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <span className="text-xs">🏁</span>
            </div>
          </div>

          {/* XP, COINS & LIVES */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-900/90 border border-amber-500/40 px-2.5 py-1.5 rounded-2xl shadow-lg text-[11px] font-black text-amber-400 flex items-center gap-1">
              <span>⚡</span> {scoreXP} XP
            </div>
            <div className="bg-slate-900/90 border border-yellow-500/40 px-2.5 py-1.5 rounded-2xl shadow-lg text-[11px] font-black text-yellow-400 flex items-center gap-1">
              <span>🪙</span> {coins}
            </div>
            <div className="bg-slate-900/90 border border-rose-500/40 px-2.5 py-1.5 rounded-2xl shadow-lg text-xs font-bold text-rose-500">
              {"❤️".repeat(Math.max(0, lives))}
            </div>
          </div>
        </div>

        {/* ================= WORLD 3D RUNNER CANVAS ================= */}
        <div className="relative flex-1 overflow-hidden flex flex-col items-center pt-16 bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-400">

          {/* Mây trời */}
          <div className="absolute top-14 w-full flex justify-around opacity-80 pointer-events-none">
            <span className="text-2xl animate-pulse">☁️</span>
            <span className="text-3xl animate-pulse delay-300">☁️</span>
          </div>

          {/* Hàng cây 2 bên đường */}
          <div className="absolute inset-x-2 top-16 bottom-0 flex justify-between px-2 pointer-events-none">
            <div className="flex flex-col space-y-10 opacity-90">
              <span className="text-3xl animate-bounce">🌲</span>
              <span className="text-3xl animate-bounce delay-100">🌳</span>
              <span className="text-3xl animate-bounce delay-200">🌲</span>
            </div>
            <div className="flex flex-col space-y-10 opacity-90">
              <span className="text-3xl animate-bounce delay-150">🌲</span>
              <span className="text-3xl animate-bounce delay-75">🌳</span>
              <span className="text-3xl animate-bounce delay-300">🌲</span>
            </div>
          </div>

          {/* ĐƯỜNG ĐUA CHÍNH */}
          <div className="absolute bottom-0 w-[84%] h-[84%] bg-[#b8532f] rounded-t-[40px] border-x-4 border-emerald-400 shadow-2xl flex flex-col items-center overflow-hidden animate-road bg-[linear-gradient(0deg,rgba(255,255,255,0.12)_2px,transparent_2px)] bg-[size:100%_45px]">

            {/* Vạch kẻ làn giữa */}
            <div className="absolute inset-y-0 w-1 bg-white/30 border-r border-dashed border-white/60"></div>

            {/* TỪ KHÓA MỤC TIÊU */}
            <div className="relative z-30 mt-4 bg-[#0d1322] border-2 border-cyan-400 px-6 py-2 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.6)] text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="text-xs">🎯</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">TỪ KHÓA MỤC TIÊU</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wide drop-shadow">
                {currentRound.target.meaning}
              </span>
            </div>

            {/* 3 CỔNG ĐÁP ÁN (3 TẦNG THỨC / LÀN ĐƯỜNG) */}
            <div className="relative z-35 w-[94%] mt-4 flex flex-col gap-2.5 px-1">
              {currentRound.options.map((opt, idx) => {
                let boxStyle = "bg-gradient-to-r from-amber-800 to-amber-700 border-amber-500 text-white shadow-lg";
                let badgeBg = "bg-emerald-600 text-white";
                let iconSymbol = "🌲";

                if (idx === 1) {
                  boxStyle = "bg-gradient-to-r from-slate-700 to-slate-600 border-slate-400 text-white shadow-lg";
                  badgeBg = "bg-cyan-600 text-white";
                  iconSymbol = "⛰️";
                } else if (idx === 2) {
                  boxStyle = "bg-gradient-to-r from-amber-700 to-amber-600 border-amber-400 text-white shadow-lg";
                  badgeBg = "bg-amber-600 text-white";
                  iconSymbol = "📦";
                }

                if (statusAnim !== null) {
                  if (opt.id === currentRound.target.id) {
                    boxStyle = "bg-emerald-600 border-white text-white scale-105 shadow-[0_0_25px_#10b981]";
                  } else if (selectedLaneIndex === idx) {
                    boxStyle = "bg-rose-600 border-white text-white animate-shake";
                  } else {
                    boxStyle = "bg-slate-900/40 border-slate-800 text-slate-500 opacity-30";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleChooseLane(opt, idx)}
                    disabled={statusAnim !== null}
                    className={`relative h-14 sm:h-16 rounded-2xl border-2 flex items-center px-4 justify-between transition-all duration-200 active:scale-95 ${boxStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shadow ${badgeBg}`}>
                        {idx + 1}
                      </span>
                      <span className="text-xl">{iconSymbol}</span>
                    </div>

                    <span className="text-base sm:text-lg font-black tracking-wide text-center flex-1 drop-shadow">
                      {opt.term}
                    </span>

                    <span className="text-emerald-300 font-bold text-xs opacity-80">»</span>
                  </button>
                );
              })}
            </div>

            {/* GÓC COMBO & MẸO */}
            <div className="absolute bottom-16 inset-x-2 z-20 flex justify-between items-end px-2 pointer-events-none">
              {combo > 1 ? (
                <div className="bg-slate-950/90 border border-amber-500/60 rounded-2xl p-2.5 shadow-xl text-center backdrop-blur-md animate-bounce">
                  <span className="text-[10px] font-black uppercase text-amber-400 block tracking-widest">COMBO</span>
                  <span className="text-2xl font-black text-amber-300">x{combo}</span>
                  <span className="text-[9px] font-bold text-pink-400 block">AMAZING!</span>
                </div>
              ) : (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 shadow-xl text-center backdrop-blur-md max-w-[120px]">
                  <span className="text-[10px] font-black uppercase text-cyan-400 block tracking-wider">💡 MẸO</span>
                  <span className="text-[9px] text-slate-300 block leading-tight mt-0.5">Chọn đúng từ khóa để nhận XP!</span>
                </div>
              )}

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 shadow-xl text-center backdrop-blur-md max-w-[120px]">
                <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">⚡ TỐC ĐỘ</span>
                <span className="text-[9px] text-slate-300 block leading-tight mt-0.5">Lướt thật nhanh tay lên nào!</span>
              </div>
            </div>

            {/* NHÂN VẬT CHẠY VỚI ẢNH ĐỘNG GIPHY BẠN CHỌN */}
            <div className={`absolute bottom-3 transition-all duration-300 z-30 flex flex-col items-center ${isMoving ? "scale-125 -translate-y-5" : "animate-bounce"}`}>
              <div className="absolute -bottom-1 flex gap-1.5 opacity-80">
                <span className="w-2.5 h-1.5 bg-white/80 rounded-full animate-ping"></span>
                <span className="w-4 h-2 bg-sky-300/80 rounded-full"></span>
                <span className="w-2 h-1 bg-white/60 rounded-full animate-pulse"></span>
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmVkeDQyeDQycHMzYjJka2toYzUxdHRvOTc5N3B5M25ldnFvdmE0bSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2qmn5mYFKrOD3vcCX6/giphy.gif"
                  alt="Custom 3D Runner Animation"
                  className="w-16 h-16 object-cover rounded-full border-2 border-cyan-400 shadow-lg filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>

          </div>

        </div>

        {/* ================= FOOTER PROGRESS BAR ================= */}
        <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-t border-slate-800 z-40">
          <span className="text-amber-400 text-lg">⭐</span>
          <div className="flex-1 mx-3 h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
            <span>{currentIndex + 1} / {rounds.length}</span>
            <span>🏁</span>
          </div>
        </div>

      </div>
    </>
  );
}

// 1. FLASHCARD GAME
function FlashcardGame({ vocabList }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState([]);
  const currentItem = vocabList[currentIndex];

  const handleNext = (e) => {
    e.stopPropagation();
    playSound("click");
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % vocabList.length);
    }, 200);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    playSound("click");
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + vocabList.length) % vocabList.length);
    }, 200);
  };

  const toggleMastered = (e) => {
    e.stopPropagation();
    playSound("correct");
    setMasteredIds(prev =>
      prev.includes(currentItem.id)
        ? prev.filter(id => id !== currentItem.id)
        : [...prev, currentItem.id]
    );
  };

  const isMastered = masteredIds.includes(currentItem.id);

  return (
    <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 border border-slate-800 shadow-2xl text-center animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">🎴</span> Flashcard Ôn Tập
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMastered}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${isMastered ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}`}
          >
            {isMastered ? "✓ Đã thuộc" : "○ Đánh dấu đã thuộc"}
          </button>
          <span className="px-3.5 py-1.5 bg-slate-800 rounded-full text-xs font-bold text-slate-300 border border-slate-700">
            Thẻ {currentIndex + 1} / {vocabList.length}
          </span>
        </div>
      </div>

      <div
        onClick={() => {
          playSound("click");
          setIsFlipped(!isFlipped);
        }}
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

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={handlePrev}
          className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-300 transition-all active:scale-95 border border-slate-700"
        >
          ← Thẻ trước
        </button>
        <span className="text-xs text-slate-500">Đã nhớ: {masteredIds.length}/{vocabList.length} từ</span>
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

// 2. THỢ SĂN TỪ VỰNG GAME (WORD SCRAMBLE)
function WordScrambleGame({ vocabList, saveScore }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledLetters, setShuffledLetters] = useState([]);
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  useEffect(() => {
    const formatted = [...vocabList]
      .filter(item => item.term && item.term.trim().length > 0)
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);

    const prepared = formatted.map(item => {
      const cleanTerm = item.term.trim();
      const letters = cleanTerm.split("").map((char, idx) => ({ id: idx, char }));
      let shuffled = [...letters].sort(() => 0.5 - Math.random());
      return {
        id: item.id,
        term: cleanTerm,
        meaning: item.meaning,
        shuffledLetters: shuffled
      };
    });

    setQuestions(prepared);
  }, [vocabList]);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]) {
      setShuffledLetters(questions[currentIndex].shuffledLetters);
      setSelectedLetters([]);
      setIsCorrect(null);
    }
  }, [currentIndex, questions]);

  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];

  const handleSelectLetter = (letterObj) => {
    playSound("click");
    setShuffledLetters(prev => prev.filter(l => l.id !== letterObj.id));
    setSelectedLetters(prev => [...prev, letterObj]);
  };

  const handleRemoveLetter = (letterObj) => {
    playSound("click");
    setSelectedLetters(prev => prev.filter(l => l.id !== letterObj.id));
    setShuffledLetters(prev => [...prev, letterObj]);
  };

  const handleCheckAnswer = () => {
    const formedWord = selectedLetters.map(l => l.char).join("");
    if (formedWord.toLowerCase() === currentQ.term.toLowerCase()) {
      playSound("correct");
      setIsCorrect(true);
      setScore(prev => prev + 1);
    } else {
      playSound("wrong");
      setIsCorrect(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
      saveScore("Thợ Săn Từ Vựng", score, questions.length);
    }
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setIsCorrect(null);
    const formatted = [...vocabList]
      .filter(item => item.term && item.term.trim().length > 0)
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);
    setQuestions(formatted.map(item => {
      const cleanTerm = item.term.trim();
      const letters = cleanTerm.split("").map((char, idx) => ({ id: idx, char }));
      return {
        id: item.id,
        term: cleanTerm,
        meaning: item.meaning,
        shuffledLetters: [...letters].sort(() => 0.5 - Math.random())
      };
    }));
  };

  if (isFinished) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-slate-800 text-center animate-fadeIn">
        <span className="text-6xl mb-4 block animate-bounce">🏆</span>
        <h3 className="text-3xl font-black text-white mb-2">Hoàn thành Thợ Săn Từ Vựng!</h3>
        <p className="text-slate-400 mb-8 text-lg">Bạn đã giải mã chính xác <strong className="text-amber-400 font-extrabold text-2xl">{score}</strong> / {questions.length} từ.</p>
        <button
          onClick={restartGame}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-xl shadow-orange-500/30 hover:scale-105 transition-all"
        >
          Chơi lại từ đầu 🔄
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-800 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">🎯</span> Thợ Săn Từ Vựng
        </h3>
        <span className="px-3.5 py-1.5 bg-amber-500/15 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
          Từ {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="p-8 bg-slate-950/60 rounded-3xl border border-slate-800/80 text-center mb-8 shadow-inner">
        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">Gợi ý nghĩa tiếng Việt:</span>
        <h4 className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight">{currentQ.meaning}</h4>
      </div>

      <div className="min-h-[80px] p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-center gap-2 mb-6">
        {selectedLetters.length === 0 ? (
          <span className="text-sm text-slate-500 italic">Bấm vào các chữ cái bên dưới để xếp từ</span>
        ) : (
          selectedLetters.map((l) => (
            <button
              key={l.id}
              disabled={isCorrect !== null}
              onClick={() => handleRemoveLetter(l)}
              className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-rose-600 text-white font-black text-xl flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
            >
              {l.char}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[60px]">
        {shuffledLetters.map((l) => (
          <button
            key={l.id}
            disabled={isCorrect !== null}
            onClick={() => handleSelectLetter(l)}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-xl flex items-center justify-center shadow-md transition-all active:scale-95"
          >
            {l.char}
          </button>
        ))}
      </div>

      {isCorrect !== null && (
        <div className={`mb-6 p-4 rounded-2xl text-center font-bold text-sm animate-fadeIn ${isCorrect ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
          {isCorrect ? "✨ Chính xác! Tuyệt vời!" : `❌ Chưa chính xác. Đáp án đúng là: ${currentQ.term}`}
        </div>
      )}

      <div className="flex justify-end">
        {isCorrect === null ? (
          <button
            onClick={handleCheckAnswer}
            disabled={selectedLetters.length === 0}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 text-white font-bold shadow-lg shadow-orange-500/30 hover:scale-105 transition-all"
          >
            Kiểm tra đáp án ↵
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-600/30 hover:scale-105 transition-all"
          >
            {currentIndex + 1 < questions.length ? "Từ tiếp theo →" : "Xem kết quả 🏆"}
          </button>
        )}
      </div>
    </div>
  );
}

// 3. QUIZ GAME
function QuizGame({ vocabList, saveScore }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);

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

  useEffect(() => {
    if (isFinished || questions.length === 0) return;
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSelect("__TIMEOUT__");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, questions, isFinished]);

  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];

  const handleSelect = (option) => {
    if (selectedOption !== null) return;
    clearInterval(timerRef.current);
    setSelectedOption(option);

    if (option === currentQ.correct) {
      playSound("correct");
      setScore((prev) => prev + 1);
    } else {
      playSound("wrong");
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-500/10 text-cyan-400">⚡</span> Trắc Nghiệm Tốc Độ
        </h3>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${timeLeft <= 5 ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse" : "bg-slate-800 text-cyan-400 border-slate-700"}`}>
            ⏱️ {timeLeft}s
          </span>
          <span className="px-3.5 py-1.5 bg-cyan-500/15 text-cyan-400 rounded-full text-xs font-bold border border-cyan-500/20">
            Câu {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      <div className="w-full bg-slate-800 h-1.5 rounded-full mb-8 overflow-hidden">
        <div
          className="bg-cyan-500 h-full transition-all duration-1000 linear"
          style={{ width: `${(timeLeft / 15) * 100}%` }}
        ></div>
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
              btnStyle = "bg-emerald-600/90 border-emerald-500 text-white shadow-lg shadow-emerald-600/30";
            } else if (opt === selectedOption) {
              btnStyle = "bg-rose-600/90 border-rose-500 text-white shadow-lg shadow-rose-600/30 animate-shake";
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

// 4. MATCHING GAME
function MatchingGame({ vocabList, saveScore }) {
  const [items, setItems] = useState({ terms: [], meanings: [] });
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [wrongMatchId, setWrongMatchId] = useState(null);
  const [errorsCount, setErrorsCount] = useState(0);
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
    setErrorsCount(0);
    setIsWon(false);
  };

  const handleSelectTerm = (item) => {
    if (matchedIds.includes(item.id)) return;
    playSound("click");
    setSelectedTerm(item);
    setWrongMatchId(null);
  };

  const handleSelectMeaning = (item) => {
    if (matchedIds.includes(item.id) || !selectedTerm) return;

    if (selectedTerm.id === item.id) {
      playSound("correct");
      const newMatched = [...matchedIds, item.id];
      setMatchedIds(newMatched);
      setSelectedTerm(null);
      setWrongMatchId(null);

      if (newMatched.length === items.terms.length) {
        setIsWon(true);
        saveScore("Nối Từ Tương Ứng", newMatched.length, items.terms.length);
      }
    } else {
      playSound("wrong");
      setErrorsCount(prev => prev + 1);
      setWrongMatchId(item.id);
      setTimeout(() => {
        setSelectedTerm(null);
        setWrongMatchId(null);
      }, 500);
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
        <p className="text-slate-400 mb-2 text-lg">Số lần ghép sai: <strong className="text-rose-400">{errorsCount}</strong></p>
        <button
          onClick={initGame}
          className="mt-6 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-xl shadow-emerald-600/30 hover:scale-105 transition-all"
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
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
            Lỗi sai: {errorsCount}
          </span>
          <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            Đã ghép: {matchedIds.length} / {items.terms.length}
          </span>
        </div>
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
                className={`w-full p-4 rounded-2xl font-bold border-2 transition-all shadow-md text-center text-base ${isSelected
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
            const isWrong = wrongMatchId === item.id;

            if (isMatched) return null;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectMeaning(item)}
                className={`w-full p-4 rounded-2xl font-semibold border-2 transition-all shadow-md text-center text-base ${isWrong
                  ? "bg-rose-600/90 border-rose-500 text-white animate-pulse"
                  : "border-slate-700/80 bg-slate-800/80 text-slate-200 hover:bg-emerald-950/40 hover:border-emerald-500/50"
                  }`}
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