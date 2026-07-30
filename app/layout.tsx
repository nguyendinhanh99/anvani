// app/layout.js
import { AuthContextProvider } from "@/src/context/AuthContext";
import "./globals.css";

export const metadata = {
  title: "Ứng dụng Học Ngôn Ngữ",
  description: "Dự án học tiếng Đức và tiếng Anh cá nhân",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="antialiased bg-gray-50 text-gray-900">
        <AuthContextProvider>
          {children}
        </AuthContextProvider>
      </body>
    </html>
  );
}