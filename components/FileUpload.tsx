
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

  const preprocessCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      
      // Basic contrast enhancement
      let contrasted = (gray - 128) * 1.5 + 128;
      contrasted = Math.max(0, Math.min(255, contrasted));

      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<string> => {
    const pdfjsLib = window.pdfjsLib;
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";
    
    // Try normal text extraction first
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    // High-density check: If text is suspiciously short or disorganized, use Cognitive OCR
    const densityThreshold = 50 * pdf.numPages;
    if (fullText.trim().length < densityThreshold && pdf.numPages > 0) {
      console.log(`PDF text density low (${fullText.length} chars). Engaging Cognitive Vision OCR...`);
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
      
      // Render page at high scale for maximum clarity
      const viewport = page.getViewport({ scale: 2.5 }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      // Apply visual pre-processing to clean up the scan
      preprocessCanvas(canvas);

      // Convert canvas to base64 for Gemini Vision
      const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      
      // Send to Gemini for advanced semantic OCR
      const extractedText = await performVisionOcr(base64Data, 'image/jpeg');
      combinedText += `--- PAGE ${i} ---\n${extractedText}\n\n`;
    }
    setOcrProgress(0);
    return combinedText;
  };

  const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const mammoth = window.mammoth;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  /**
   * Fixes property access errors on 'unknown' by explicitly typing fileList and the map parameters.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    // Explicitly type fileList as File[] to resolve 'unknown' errors
    const fileList: File[] = Array.from(e.target.files);
    
    // Type the map parameter f as File
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
      // file is correctly inferred as File here
      const file = fileList[i];
      try {
        let text = "";
        const arrayBuffer = await file.arrayBuffer();

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          text = await extractTextFromPdf(arrayBuffer, file.name);
        } else if (
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.endsWith('.docx')
        ) {
          text = await extractTextFromDocx(arrayBuffer);
        } else {
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
          accept=".txt,.csv,.md,.json,.pdf,.docx"
        />
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
            <ICONS.Document />
          </div>
          <p className="text-slate-700 font-medium">Click to upload sales documents</p>
          <p className="text-slate-400 text-sm mt-1">Accepts PDF (w/ Advanced Vision OCR), Word, TXT, CSV, MD, JSON</p>
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
                        {isCognitiveOcr ? `Cognitive Vision Engine (${ocrProgress}%)` : 'Parsing Structure...'}
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
