import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { word } = await request.json();
    if (!word) {
      return NextResponse.json({ error: "Thiếu từ cần dịch" }, { status: 400 });
    }

    // Đổi autoflat thành autodetect để hệ thống tự động nhận diện ngôn ngữ chuẩn xác
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=autodetect|vi`
    );
    const data = await response.json();
    
    let translatedMeaning = "";
    if (data && data.responseData && data.responseData.translatedText) {
      translatedMeaning = data.responseData.translatedText;
    }

    return NextResponse.json({ meaning: translatedMeaning });
  } catch (error) {
    console.error("Lỗi dịch từ:", error);
    return NextResponse.json({ error: "Lỗi hệ thống dịch" }, { status: 500 });
  }
}