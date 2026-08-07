import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; // Font chữ tối ưu hóa
import { AuthContextProvider } from "@/src/context/AuthContext";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"; // Tối ưu hiệu năng
import "./globals.css";

// 1. Tối ưu Font chữ (Google Font được tối ưu sẵn cho Next.js)
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

// 2. Metadata chuẩn SEO
export const metadata: Metadata = {
title: "Anvani Pro - Ứng dụng Học Ngôn Ngữ",
  icons: {
    icon: "./owl.png", // Next.js sẽ tự tìm file owl.png bên trong thư mục public
  },
  description: "Nền tảng học tiếng Đức và tiếng Anh hiệu quả, tùy chỉnh theo lộ trình cá nhân của bạn.",
  keywords: ["học tiếng Đức", "học tiếng Anh", "ứng dụng học ngôn ngữ", "lộ trình học cá nhân"],
  authors: [{ name: "Tên Của Bạn" }],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://ten-mien-cua-ban.com",
    title: "Anvani Pro",
    description: "Học ngoại ngữ thông minh hơn.",
    siteName: "Anvani Pro",
  },
};

// 3. Viewport (Cấu hình hiển thị mobile)
export const viewport: Viewport = {
  themeColor: "#4f46e5", // Màu chủ đạo của app
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={`${inter.className} antialiased bg-slate-50 text-slate-900 min-h-screen selection:bg-indigo-100`}>
        {/* AuthProvider được bao bọc cẩn thận */}
        <AuthContextProvider>
          <main className="flex flex-col min-h-screen">
            {children}
          </main>
        </AuthContextProvider>
        
        {/* Các công cụ theo dõi */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}