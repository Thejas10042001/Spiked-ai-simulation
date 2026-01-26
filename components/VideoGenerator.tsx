
import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../types';
import { ICONS } from '../constants';
import { startVideoGeneration, getVideoStatus } from '../services/geminiService';

interface VideoGeneratorProps {
  analysis: AnalysisResult;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ analysis }) => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    await (window as any).aistudio.openSelectKey();
    setHasApiKey(true); // Assume success per instructions
  };

  const generatePitchVideo = async () => {
    setIsGenerating(true);
    setError(null);
    setStatusMessage("Conceptualizing visual metaphor...");

    const messages = [
      "Directing scene transitions...",
      "Synthesizing persona-aligned visuals...",
      "Rendering cinematic strategic frames...",
      "Finalizing high-fidelity explainer...",
      "Grounding visual content in source data..."
    ];

    let msgIdx = 0;
    const interval = setInterval(() => {
      setStatusMessage(messages[msgIdx % messages.length]);
      msgIdx++;
    }, 15000);

    try {
      // Craft a visual prompt based on analysis
      const visualPrompt = `A high-end cinematic business explainer video for a ${analysis.snapshot.role}. 
      The tone is ${analysis.snapshot.tone}. Visuals should emphasize ${analysis.snapshot.priorities[0].text}. 
      Use sleek, minimalist corporate office aesthetics, high-tech abstract data overlays, and diverse professional people collaborating. 
      Lighting should be bright and modern. Cinematic quality.`;

      let operation = await startVideoGeneration(visualPrompt, aspectRatio);
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await getVideoStatus(operation);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("entity was not found")) {
        setHasApiKey(false);
        setError("Selected API key project not found. Please re-select a paid project.");
      } else {
        setError("Video generation failed. Please try again.");
      }
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  if (!hasApiKey) {
    return (
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl border border-slate-800">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-indigo-500/20 shadow-lg rotate-3">
          <ICONS.Sparkles />
        </div>
        <h3 className="text-3xl font-black tracking-tight">Activate Visual Intelligence</h3>
        <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
          High-fidelity video generation requires access to a paid Google Cloud project via the Gemini API. 
          Please select a project with active billing to continue.
        </p>
        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={handleOpenKeySelection}
            className="px-8 py-4 bg-white text-slate-900 font-black rounded-full hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95"
          >
            Select Paid API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="text-xs text-indigo-400 font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors"
          >
            Review Billing Documentation
          </a>
        </div>
        {error && <p className="text-rose-400 text-xs font-bold bg-rose-950/30 py-2 px-4 rounded-full border border-rose-900/50">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl overflow-hidden relative">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
            <ICONS.Play />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">AI Explainer Studio</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Generative Video Strategy</p>
          </div>
        </div>

        {!videoUrl && !isGenerating && (
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-full border border-slate-200">
            <button 
              onClick={() => setAspectRatio('16:9')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${aspectRatio === '16:9' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              16:9 Desktop
            </button>
            <button 
              onClick={() => setAspectRatio('9:16')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${aspectRatio === '9:16' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              9:16 Mobile
            </button>
          </div>
        )}
      </div>

      {isGenerating ? (
        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] py-24 flex flex-col items-center justify-center space-y-6">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800 animate-pulse">{statusMessage}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Veo 3.1 Neural Engine Engaged</p>
          </div>
        </div>
      ) : videoUrl ? (
        <div className="space-y-6 animate-in fade-in zoom-in duration-700">
          <div className="aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl relative group">
            <video src={videoUrl} controls className="w-full h-full object-contain" />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Grounded Visual Pitch Ready</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setVideoUrl(null)}
                className="px-6 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 transition-colors"
              >
                Regenerate
              </button>
              <a 
                href={videoUrl} 
                download="sales-pitch-explainer.mp4"
                className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Download MP4
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 space-y-8">
          <div className="max-w-md mx-auto">
            <h4 className="text-xl font-bold text-slate-800 mb-2">Transform Strategy into Vision</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              We'll use your documents and the analyzed persona to create a cinematic 10-second explainer 
              that visually handles the top objections of the <strong>{analysis.snapshot.role}</strong>.
            </p>
          </div>
          <button 
            onClick={generatePitchVideo}
            className="inline-flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-full font-black text-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-100"
          >
            <ICONS.Play />
            Generate Pitch Video
          </button>
          {error && <p className="text-rose-500 text-xs font-bold mt-4">⚠️ {error}</p>}
        </div>
      )}
    </div>
  );
};
