
import React, { useRef, useState } from 'react';
import { UploadedFile } from '../types';
import { ICONS } from '../constants';
import { performVisionOcr } from '../services/geminiService';

declare global {
  interface Window {
    mammoth: any;
    pdfjsLib: any;
  }
}

interface FileUploadProps {
  // Fixed: Changed onFilesChange type to support React state action updates
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  files: UploadedFile[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isCognitiveOcr, setIsCognitiveOcr] = useState<boolean>(false);

  /**
   * High-Precision Cognitive Image Preprocessing.
   * Cleans luminance, whiteness backgrounds, and sharpens character edges.
   */
  const preprocessCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 1. Luminance Normalization
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < min) min = avg;
      if (avg > max) max = avg;
    }

    const range = max - min || 1;
    for (let i = 0; i < data.length; i += 4) {
      let gray = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      gray = ((gray - min) / range) * 255;
      
      // Adaptive Background Whitening
      if (gray > 185) gray = 255; 
      if (gray < 70) gray = 0;

      data[i] = data[i+1] = data[i+2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    // 2. Sharpness Convolution Pass (Laplacian Hybrid)
    const kernel = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    applyConvolution(canvas, kernel);
  };

  const applyConvolution = (canvas: HTMLCanvasElement, kernel: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sw = src.width, sh = src.height;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data, srcData = src.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide, scx = x + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = kernel[cy * side + cx];
              r += srcData[srcOff] * wt;
              g += srcData[srcOff + 1] * wt;
              b += srcData[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = Math.min(255, Math.max(0, r));
        dst[dstOff+1] = Math.min(255, Math.max(0, g));
        dst[dstOff+2] = Math.min(255, Math.max(0, b));
        dst[dstOff+3] = 255;
      }
    }
    ctx.putImageData(output, 0, 0);
  };

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<string> => {
    const pdfjsLib = window.pdfjsLib;
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }

    if (fullText.trim().length < 50 * pdf.numPages && pdf.numPages > 0) {
      setIsCognitiveOcr(true);
      fullText = await performCognitiveOcr(pdf);
      setIsCognitiveOcr(false);
    }

    return fullText;
  };

  const performCognitiveOcr = async (pdf: any): Promise<string> => {
    let combinedText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setOcrProgress(Math.round((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 4.0 }); // Ultra-HD 4.0x Scale
      const canvas = document.createElement('canvas');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      preprocessCanvas(canvas);
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      const extractedText = await performVisionOcr(base64Data, 'image/png');
      combinedText += `--- PAGE ${i} ---\n${extractedText}\n\n`;
    }
    setOcrProgress(0);
    return combinedText;
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    setIsCognitiveOcr(true);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          preprocessCanvas(canvas);
          const base64Data = canvas.toDataURL('image/png').split(',')[1];
          try {
            const text = await performVisionOcr(base64Data, 'image/png');
            setIsCognitiveOcr(false);
            resolve(text);
          } catch (err) { reject(err); }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    // Cast to File[] to fix 'unknown' type errors for property access (name, type, arrayBuffer).
    const fileList = Array.from(e.target.files) as File[];
    const placeholders: UploadedFile[] = fileList.map(f => ({ name: f.name, content: '', type: f.type, status: 'processing' }));
    onFilesChange(prev => [...prev, ...placeholders]);

    for (const file of fileList) {
      try {
        let text = "";
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          text = await extractTextFromPdf(await file.arrayBuffer(), file.name);
        } else if (file.type.startsWith('image/')) {
          text = await extractTextFromImage(file);
        } else if (file.name.endsWith('.docx')) {
          text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
        } else {
          text = new TextDecoder().decode(await file.arrayBuffer());
        }
        onFilesChange(prev => prev.map(f => f.name === file.name ? { ...f, content: text, status: 'ready' } : f));
      } catch (err) {
        onFilesChange(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 cursor-pointer bg-white/50" onClick={() => fileInputRef.current?.click()}>
        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.txt,.csv,.md,image/*" />
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3"><ICONS.Document /></div>
          <p className="text-slate-700 font-medium">Cognitive Intake Hub</p>
          <p className="text-slate-400 text-sm mt-1">High-Precision OCR for Scanned PDFs and Images</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {files.map((file, idx) => (
          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className={`shrink-0 ${file.status === 'ready' ? 'text-indigo-500' : 'text-slate-400'}`}><ICONS.Document /></div>
                <span className="text-sm font-semibold text-slate-700 truncate">{file.name}</span>
              </div>
              <button onClick={() => onFilesChange(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500"><ICONS.X /></button>
            </div>
            {file.status === 'processing' && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                  {isCognitiveOcr ? `Neural Scan (${ocrProgress}%)` : 'Grounded Parsing...'}
                </span>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-[progress_1s_infinite] w-full origin-left"></div></div>
              </div>
            )}
            {file.status === 'ready' && <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"><ICONS.Shield className="w-2 h-2" /> Context Loaded</span>}
          </div>
        ))}
      </div>
      <style>{`@keyframes progress { 0% { transform: scaleX(0); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
};
