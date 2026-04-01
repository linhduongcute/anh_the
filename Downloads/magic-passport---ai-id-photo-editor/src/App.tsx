/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Camera, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---

type BackgroundType = 'Trắng' | 'Xanh nhạt' | 'Xám' | 'Tùy chỉnh';
type ClothingType = 'Chọn kiểu' | 'Tùy chỉnh' | 'Dùng mẫu';
type MakeupType = 'Không màu' | 'Đỏ' | 'Hồng' | 'Nude' | 'Tùy chỉnh';
type HairstyleType = 'Ngẫu nhiên' | 'Tóc mái' | 'Vuốt ngược' | 'Giữ nguyên gốc';

interface AppState {
  background: BackgroundType;
  customBackground: string;
  clothing: ClothingType;
  clothingStyle: string;
  customClothing: string;
  accessories: string;
  makeup: MakeupType;
  customMakeup: string;
  hairstyle: HairstyleType;
  keepOriginalFace: boolean;
  smoothSkin: boolean;
  smile: boolean;
  keepOriginalHair: boolean;
}

// --- Constants ---

const CLOTHING_STYLES = [
  "Sơ mi trắng",
  "Vest đen với sơ mi trắng",
  "Vest xanh đen với sơ mi trắng",
  "Sơ mi xanh nhạt",
  "Áo dài truyền thống",
  "Áo thun cổ tròn trắng",
  "Áo thun cổ tròn đen"
];

const INITIAL_STATE: AppState = {
  background: 'Trắng',
  customBackground: '',
  clothing: 'Chọn kiểu',
  clothingStyle: CLOTHING_STYLES[0],
  customClothing: '',
  accessories: '',
  makeup: 'Không màu',
  customMakeup: '',
  hairstyle: 'Ngẫu nhiên',
  keepOriginalFace: true,
  smoothSkin: true,
  smile: false,
  keepOriginalHair: false,
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setEditedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePhoto = async () => {
    if (!originalImage) {
      setError("Vui lòng tải ảnh lên trước.");
      return;
    }

    // Use the API Key from environment, injected by the platform
    const apiKey = process.env.GEMINI_API_KEY;

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey || "" });
      
      // Construct the prompt
      let prompt = "Edit this ID photo based on the following requirements:";
      
      // Background
      if (state.background === 'Tùy chỉnh') {
        prompt += ` Change background to: ${state.customBackground}.`;
      } else {
        prompt += ` Change background to ${state.background.toLowerCase()}.`;
      }

      // Clothing
      if (state.clothing === 'Chọn kiểu') {
        prompt += ` Change clothing to ${state.clothingStyle}.`;
      } else if (state.clothing === 'Tùy chỉnh') {
        prompt += ` Change clothing to: ${state.customClothing}.`;
      }

      // Accessories
      if (state.accessories) {
        prompt += ` Add accessories: ${state.accessories}.`;
      }

      // Makeup
      if (state.makeup !== 'Không màu') {
        const color = state.makeup === 'Tùy chỉnh' ? state.customMakeup : state.makeup;
        prompt += ` Apply ${color.toLowerCase()} lipstick makeup.`;
      }

      // Hairstyle
      if (state.hairstyle !== 'Giữ nguyên gốc') {
        prompt += ` Change hairstyle to ${state.hairstyle.toLowerCase()}.`;
      }

      // Options
      if (state.keepOriginalFace) prompt += " Keep the original facial features strictly.";
      if (state.smoothSkin) prompt += " Apply subtle skin smoothing.";
      if (state.smile) prompt += " Add a subtle, professional smile.";

      prompt += " Ensure the output is a professional ID photo with high quality, centered subject, and realistic lighting.";

      // Extract mime type and base64 data correctly
      const mimeTypeMatch = originalImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
      const base64Data = originalImage.replace(/^data:image\/[a-z]+;base64,/, "");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt }
          ]
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI không trả về kết quả nào. Có thể do nội dung ảnh không phù hợp.");
      }

      let foundImage = false;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setEditedImage(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("AI đã xử lý nhưng không tạo ra ảnh mới. Vui lòng thử thay đổi yêu cầu.");
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      const errorMessage = err.message || "Đã xảy ra lỗi không xác định.";
      
      if (errorMessage.includes("API key not valid")) {
        setError("Lỗi: API Key không hợp lệ. Vui lòng kiểm tra lại cấu hình.");
      } else if (errorMessage.includes("safety")) {
        setError("Lỗi: Ảnh hoặc yêu cầu bị từ chối do chính sách an toàn.");
      } else {
        setError(`Lỗi: ${errorMessage}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 mb-1">MAGIC PASSPORT</h1>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          Xuân Tóc Đỏ & MAGICBOX.VN
        </p>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Sidebar Controls */}
        <aside className="card p-6 space-y-6 sticky top-8">
          {/* Background Section */}
          <section>
            <label className="control-label">Thay nền</label>
            <div className="radio-group">
              {(['Trắng', 'Xanh nhạt', 'Xám', 'Tùy chỉnh'] as BackgroundType[]).map((bg) => (
                <label key={bg} className="radio-item">
                  <input
                    type="radio"
                    className="radio-input"
                    checked={state.background === bg}
                    onChange={() => setState({ ...state, background: bg })}
                  />
                  {bg}
                </label>
              ))}
            </div>
            {state.background === 'Tùy chỉnh' && (
              <div className="flex items-center gap-2 mt-2">
                <div className="relative w-8 h-8 rounded border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                  <input
                    type="color"
                    className="absolute inset-[-10px] w-[150%] h-[150%] cursor-pointer"
                    value={state.customBackground.startsWith('#') ? state.customBackground : '#ffffff'}
                    onChange={(e) => setState({ ...state, customBackground: e.target.value })}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Mã màu hoặc mô tả..."
                  className="flex-1 text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                  value={state.customBackground}
                  onChange={(e) => setState({ ...state, customBackground: e.target.value })}
                />
              </div>
            )}
          </section>

          {/* Clothing Section */}
          <section>
            <label className="control-label">Thay áo</label>
            <div className="radio-group">
              {(['Chọn kiểu', 'Tùy chỉnh', 'Dùng mẫu'] as ClothingType[]).map((c) => (
                <label key={c} className="radio-item">
                  <input
                    type="radio"
                    className="radio-input"
                    checked={state.clothing === c}
                    onChange={() => setState({ ...state, clothing: c })}
                  />
                  {c}
                </label>
              ))}
            </div>
            {state.clothing === 'Chọn kiểu' && (
              <select
                className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                value={state.clothingStyle}
                onChange={(e) => setState({ ...state, clothingStyle: e.target.value })}
              >
                {CLOTHING_STYLES.map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            )}
            {state.clothing === 'Tùy chỉnh' && (
              <input
                type="text"
                placeholder="Ví dụ: Áo sơ mi caro, áo len..."
                className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                value={state.customClothing}
                onChange={(e) => setState({ ...state, customClothing: e.target.value })}
              />
            )}
          </section>

          {/* Accessories Section */}
          <section>
            <label className="control-label">Thêm phụ kiện: kính, trang sức...</label>
            <textarea
              placeholder="ví dụ: đeo kính gọng đen..."
              className="w-full text-xs p-2 border border-slate-200 rounded h-20 resize-none focus:ring-1 focus:ring-emerald-500 outline-none"
              value={state.accessories}
              onChange={(e) => setState({ ...state, accessories: e.target.value })}
            />
          </section>

          {/* Makeup Section */}
          <section>
            <label className="control-label">Trang điểm</label>
            <div className="text-[10px] text-slate-400 mb-1">Màu son</div>
            <div className="radio-group">
              {(['Không màu', 'Đỏ', 'Hồng', 'Nude', 'Tùy chỉnh'] as MakeupType[]).map((m) => (
                <label key={m} className="radio-item">
                  <input
                    type="radio"
                    className="radio-input"
                    checked={state.makeup === m}
                    onChange={() => setState({ ...state, makeup: m })}
                  />
                  {m}
                </label>
              ))}
            </div>
            {state.makeup === 'Tùy chỉnh' && (
              <input
                type="text"
                placeholder="Ví dụ: Cam đào, đỏ rượu..."
                className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                value={state.customMakeup}
                onChange={(e) => setState({ ...state, customMakeup: e.target.value })}
              />
            )}
          </section>

          {/* Hairstyle Section */}
          <section>
            <label className="control-label">Kiểu tóc</label>
            <div className="radio-group">
              {(['Ngẫu nhiên', 'Tóc mái', 'Vuốt ngược', 'Giữ nguyên gốc'] as HairstyleType[]).map((h) => (
                <label key={h} className="radio-item">
                  <input
                    type="radio"
                    className="radio-input"
                    checked={state.hairstyle === h}
                    onChange={() => setState({ ...state, hairstyle: h })}
                  />
                  {h}
                </label>
              ))}
            </div>
          </section>

          {/* Options Section */}
          <section className="pt-2 border-t border-slate-100">
            <label className="checkbox-item">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={state.keepOriginalFace}
                onChange={(e) => setState({ ...state, keepOriginalFace: e.target.checked })}
              />
              Giữ nguyên mặt gốc
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={state.smoothSkin}
                onChange={(e) => setState({ ...state, smoothSkin: e.target.checked })}
              />
              Làm mịn da
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={state.smile}
                onChange={(e) => setState({ ...state, smile: e.target.checked })}
              />
              Cười mỉm
            </label>
          </section>

          <button
            onClick={generatePhoto}
            disabled={isProcessing || !originalImage}
            className={cn(
              "w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
              isProcessing || !originalImage
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-brand-primary text-emerald-900 hover:bg-emerald-300 active:scale-95 shadow-sm"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Thực hiện"
            )}
          </button>
        </aside>

        {/* Main Image Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Original Image */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium text-slate-600 mb-3">Ảnh gốc</h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full aspect-[3/4] card flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all",
                !originalImage && "border-dashed border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30"
              )}
            >
              {originalImage ? (
                <div className="relative w-full h-full">
                  <img src={originalImage} alt="Original" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <RefreshCw className="text-white w-8 h-8" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Click để tải ảnh lên</p>
                  <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ JPG, PNG</p>
                </>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Edited Image */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium text-slate-600 mb-3">Ảnh chỉnh</h3>
            <div className="w-full aspect-[3/4] card flex flex-col items-center justify-center overflow-hidden relative">
              <AnimatePresence mode="wait">
                {editedImage ? (
                  <motion.img
                    key="edited"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={editedImage}
                    alt="Edited"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-8"
                  >
                    {isProcessing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                        <p className="text-xs text-slate-500 font-medium">AI đang tạo ảnh mới...</p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">Có thể mất 10-20 giây</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-400 font-medium">Your generated photo will appear here.</p>
                        <p className="text-[10px] text-slate-400 mt-1">Adjust the settings and click "Thực hiện".</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-[11px] text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-100"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </motion.div>
            )}

            {editedImage && !isProcessing && (
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = editedImage;
                  link.download = 'magic-passport-photo.png';
                  link.click();
                }}
                className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4"
              >
                Tải ảnh về máy
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="mt-12 text-center text-[10px] text-slate-400 max-w-2xl">
        <p>© 2026 Magic Passport AI. Powered by Google Gemini 2.5 Flash Image.</p>
        <p className="mt-1">Lưu ý: Kết quả có thể khác nhau tùy thuộc vào chất lượng ảnh gốc và độ phức tạp của yêu cầu.</p>
      </footer>
    </div>
  );
}
