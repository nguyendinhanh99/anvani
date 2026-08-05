import { AuthContextProvider } from "@/src/context/AuthContext";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata = {
  title: "Ứng dụng Học Ngôn Ngữ",
  description: "Dự án học tiếng Đức và tiếng Anh cá nhân",
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="vi">
      <body className="antialiased bg-gray-50 text-gray-900">
        <AuthContextProvider>
          {children}
        </AuthContextProvider>
        <Analytics />
      </body>
    </html>
  );
}