
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
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, files }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isCognitiveOcr, setIsCognitiveOcr] = useState<boolean>(false);

  /**
   * Advanced image enhancement for maximum OCR accuracy.
   * Performs luminance normalization, adaptive thresholding, and edge sharpening.
   */
  const preprocessCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 1. Luminance Normalization & Background Whitening
    // We calculate min/max brightness to stretch the histogram
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < min) min = avg;
      if (avg > max) max = avg;
    }

    const range = max - min || 1;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Grayscale conversion
      let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      // Histogram stretch
      gray = ((gray - min) / range) * 255;

      // Adaptive background whitening: push light grays to pure white
      if (gray > 200) gray = 255;
      // Push dark grays to pure black for better contrast
      if (gray < 50) gray = 0;

      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    // 2. High-Pass Sharpening Filter (3x3 Kernel)
    // Stronger sharpen kernel to define character edges
    const sharpenKernel = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    applyConvolution(canvas, sharpenKernel);
  };

  const applyConvolution = (canvas: HTMLCanvasElement, kernel: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const weights = kernel;
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sw = src.width;
    const sh = src.height;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data;
    const srcData = src.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += srcData[srcOff] * wt;
              g += srcData[srcOff + 1] * wt;
              b += srcData[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = Math.min(255, Math.max(0, r));
        dst[dstOff + 1] = Math.min(255, Math.max(0, g));
        dst[dstOff + 2] = Math.min(255, Math.max(0, b));
        dst[dstOff + 3] = srcData[dstOff + 3];
      }
    }
    ctx.putImageData(output, 0, 0);
  };

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<string> => {
    const pdfjsLib = window.pdfjsLib;
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    // Attempt standard text layer extraction first
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    // engages Cognitive OCR if the PDF is purely image-based or has low text density
    const densityThreshold = 50 * pdf.numPages;
    if (fullText.trim().length < densityThreshold && pdf.numPages > 0) {
      console.log(`Engaging High-Fidelity Cognitive Vision OCR for: ${fileName}`);
      setIsCognitiveOcr(true);
      fullText = await performCognitiveOcr(pdf);
      setIsCognitiveOcr(false);
    }

    return fullText;
  };

  const performCognitiveOcr = async (pdf: any): Promise<string> => {
    let combinedText = "";
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      setOcrProgress(Math.round((i / numPages) * 100));
      const page = await pdf.getPage(i);
      
      // Render page at EXTREMELY HIGH scale (4.0x) for maximum detail preservation
      const viewport = page.getViewport({ scale: 4.0 }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      // Enhance pixel quality for OCR
      preprocessCanvas(canvas);

      // Use PNG (Lossless) to avoid JPEG compression artifacts that can confuse OCR
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      const extractedText = await performVisionOcr(base64Data, 'image/png');
      combinedText += `--- PAGE ${i} ---\n${extractedText}\n\n`;
    }
    setOcrProgress(0);
    return combinedText;
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    setIsCognitiveOcr(true);
    setOcrProgress(50);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          
          if (canvas) preprocessCanvas(canvas);
          
          const base64Data = canvas.toDataURL('image/png').split(',')[1];
          try {
            const text = await performVisionOcr(base64Data, 'image/png');
            setOcrProgress(0);
            setIsCognitiveOcr(false);
            resolve(text);
          } catch (err) {
            reject(err);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const mammoth = window.mammoth;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const fileList: File[] = Array.from(e.target.files);
    const placeholders: UploadedFile[] = fileList.map((f: File) => ({
      name: f.name,
      content: '',
      type: f.type,
      status: 'processing'
    }));
    
    const initialFiles = [...files, ...placeholders];
    onFilesChange(initialFiles);

    let currentFilesState = [...initialFiles];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        let text = "";
        
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          text = await extractTextFromPdf(arrayBuffer, file.name);
        } else if (file.type.startsWith('image/')) {
          text = await extractTextFromImage(file);
        } else if (
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.endsWith('.docx')
        ) {
          const arrayBuffer = await file.arrayBuffer();
          text = await extractTextFromDocx(arrayBuffer);
        } else {
          const arrayBuffer = await file.arrayBuffer();
          text = new TextDecoder().decode(arrayBuffer);
        }
        
        const idx = currentFilesState.findIndex(f => f.name === file.name && f.status === 'processing');
        if (idx !== -1) {
          currentFilesState[idx] = {
            ...currentFilesState[idx],
            content: text,
            status: 'ready'
          };
          onFilesChange([...currentFilesState]);
        }
      } catch (err) {
        console.error("Extraction error:", err);
        const idx = currentFilesState.findIndex(f => f.name === file.name && f.status === 'processing');
        if (idx !== -1) {
          currentFilesState[idx].status = 'error';
          onFilesChange([...currentFilesState]);
        }
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-white/50"
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.csv,.md,.json,.pdf,.docx,image/*"
        />
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
            <ICONS.Document />
          </div>
          <p className="text-slate-700 font-medium">Click to upload sales documents</p>
          <p className="text-slate-400 text-sm mt-1">PDF (Scans), Images (Photos), Word, TXT, CSV, MD</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`shrink-0 ${file.status === 'ready' ? 'text-indigo-500' : 'text-slate-400'}`}>
                    <ICONS.Document />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 truncate">{file.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <ICONS.X />
                </button>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  {file.status === 'processing' && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                        {isCognitiveOcr ? `High-Fidelity OCR Engine (${ocrProgress}%)` : 'Parsing Structure...'}
                      </span>
                    </div>
                  )}
                  {file.status === 'ready' && (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Grounded & Ready</span>
                    </div>
                  )}
                  {file.status === 'error' && (
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Error Reading File</span>
                  )}
                </div>
              </div>

              {file.status === 'processing' && (
                <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 animate-[progress_1s_ease-in-out_infinite] w-full origin-left"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};
