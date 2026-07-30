"use client";

import { useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("login"); 
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const validatePassword = (pass) => {
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    return pass.length >= 8 && hasLetter && hasNumber;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (mode === "register") {
        if (!validatePassword(password)) {
          setError("Mật khẩu phải có ít nhất 8 ký tự và bao gồm cả chữ cái và số.");
          setIsLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccess("Tạo tài khoản thành công! Vui lòng đăng nhập.");
        setMode("login");
        setPassword("");
      } else if (mode === "login") {
        await login(email, password);
        router.push("/");
      } else if (mode === "forgot") {
        if (!email) {
          setError("Vui lòng nhập email của bạn để khôi phục mật khẩu.");
          setIsLoading(false);
          return;
        }
        await sendPasswordResetEmail(auth, email);
        setSuccess("Email khôi phục mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư!");
        setMode("login");
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Email này đã được đăng ký tài khoản khác.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Email hoặc mật khẩu không chính xác.");
      } else if (err.code === "auth/user-not-found") {
        setError("Không tìm thấy tài khoản với email này.");
      } else {
        setError("Đã có lỗi xảy ra. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans">
      {/* CỘT TRÁI: Branding / Không gian thị giác (Chỉ hiện từ màn hình trung bình trở lên) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 p-12 flex-col justify-between overflow-hidden">
        {/* Hiệu ứng trang trí nền */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Logo / Thương hiệu */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-2xl shadow-lg">
            📚
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Anvani <span className="text-indigo-400">Beta</span>
          </span>
        </div>

        {/* Nội dung trung tâm cột trái */}
        <div className="relative z-10 max-w-lg my-auto py-12">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-indigo-200 text-xs font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Nền tảng ghi nhớ từ vựng thông minh</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Mở rộng vốn từ mỗi ngày, chinh phục ngôn ngữ mới.
          </h1>
          <p className="text-indigo-200 text-base leading-relaxed">
            Hệ thống học tập tối ưu giúp bạn lưu trữ, ôn tập và ghi nhớ từ vựng dài hạn bằng phương pháp khoa học nhất.
          </p>
        </div>

        {/* Footer cột trái */}
        <div className="relative z-10 text-xs text-indigo-300">
          © 2026 Anvani. All rights reserved.
        </div>
      </div>

      {/* CỘT PHẢI: Khung Form tương tác chính */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          
          {/* Mobile Header (Chỉ hiện trên mobile) */}
          <div className="lg:hidden flex items-center space-x-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white text-xl shadow-md">
              📚
            </div>
            <span className="text-lg font-bold text-gray-900">VocabMaster</span>
          </div>

          {/* Tiêu đề Form */}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              {mode === "register" && "Tạo tài khoản mới ✨"}
              {mode === "login" && "Chào mừng trở lại! 👋"}
              {mode === "forgot" && "Khôi phục mật khẩu 🔒"}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === "register" && "Điền thông tin bên dưới để bắt đầu hành trình."}
              {mode === "login" && "Vui lòng nhập thông tin tài khoản của bạn."}
              {mode === "forgot" && "Nhập email của bạn để nhận liên kết đặt lại mật khẩu."}
            </p>
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-100 flex items-start space-x-3 animate-shake">
              <span className="text-lg leading-none">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Thông báo thành công */}
          {success && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-100 flex items-start space-x-3">
              <span className="text-lg leading-none">✅</span>
              <div className="flex-1 font-medium">{success}</div>
            </div>
          )}

          {/* Form chính */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Địa chỉ Email
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  ✉️
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3.5 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 text-sm"
                  placeholder="nguyenvan@example.com"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Mật khẩu
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    🔑
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-12 py-3.5 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-1 transition"
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>

                {mode === "register" && (
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    * Mật khẩu tối thiểu 8 ký tự, bao gồm cả chữ cái và số.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>
                  {mode === "register" && "Đăng ký tài khoản"}
                  {mode === "login" && "Đăng nhập hệ thống"}
                  {mode === "forgot" && "Gửi yêu cầu khôi phục"}
                </span>
              )}
            </button>
          </form>

          {/* Điều hướng chuyển đổi chế độ */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-100">
            {mode === "register" && (
              <p>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  Đăng nhập ngay
                </button>
              </p>
            )}

            {mode === "login" && (
              <p>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  Tạo tài khoản mới
                </button>
              </p>
            )}

            {mode === "forgot" && (
              <p>
                Nhớ lại mật khẩu rồi?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  Quay lại đăng nhập
                </button>
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}