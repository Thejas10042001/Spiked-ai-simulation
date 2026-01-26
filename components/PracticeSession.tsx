
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnalysisResult } from '../types';
import { ICONS } from '../constants';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface PracticeSessionProps {
  analysis: AnalysisResult;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({ analysis }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [transcription, setTranscription] = useState<{ user: string; ai: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', ai: '' });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manual implementation of encode/decode as required by guidelines
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const stopPractice = useCallback(() => {
    setIsActive(false);
    setStatus('idle');
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startPractice = async () => {
    setStatus('connecting');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus('active');
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              setCurrentTranscription(prev => ({ ...prev, user: prev.user + message.serverContent!.inputTranscription!.text }));
            }
            if (message.serverContent?.outputTranscription) {
              setCurrentTranscription(prev => ({ ...prev, ai: prev.ai + message.serverContent!.outputTranscription!.text }));
            }
            if (message.serverContent?.turnComplete) {
              setTranscription(prev => [...prev, { user: currentTranscription.user, ai: currentTranscription.ai }]);
              setCurrentTranscription({ user: '', ai: '' });
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus('error');
            stopPractice();
          },
          onclose: () => {
            stopPractice();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          systemInstruction: `You are simulating a practice sales session. ACT AS THE BUYER defined in the following profile:
          ROLE: ${analysis.snapshot.role}
          DECISION STYLE: ${analysis.snapshot.decisionStyle}
          RISK TOLERANCE: ${analysis.snapshot.riskTolerance}
          TONE: ${analysis.snapshot.tone}
          PRIORITIES: ${analysis.snapshot.priorities.map(p => p.text).join(', ')}
          
          Guidelines:
          1. React naturally to the salesperson.
          2. Use objections like: ${analysis.objectionHandling.map(o => o.objection).join(', ')} if appropriate.
          3. Don't be too easy. Challenge them.
          4. Keep responses brief but impactful.`
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const [error, setError] = useState<string | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl overflow-hidden relative min-h-[600px] flex flex-col">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg">
            <ICONS.Chat />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Live Simulation Chamber</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Real-time Persona Practice</p>
          </div>
        </div>
        {isActive && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Session Active</span>
            </div>
            <button 
              onClick={stopPractice}
              className="px-6 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
            >
              End Simulation
            </button>
          </div>
        )}
      </div>

      {!isActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-2xl mx-auto py-10">
          <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 relative">
            <ICONS.Brain />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">AI</div>
          </div>
          <div className="space-y-4">
            <h4 className="text-2xl font-black text-slate-800">Practice with the {analysis.snapshot.role}</h4>
            <p className="text-slate-500 leading-relaxed">
              Step into the simulation chamber. Our AI will assume the psychological profile inferred from your documents. 
              Speak into your microphone and handle the objections in real-time.
            </p>
          </div>
          
          <button
            onClick={startPractice}
            disabled={status === 'connecting'}
            className={`
              inline-flex items-center gap-4 px-12 py-6 rounded-full font-black text-xl shadow-2xl transition-all
              ${status === 'connecting' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-100'}
            `}
          >
            {status === 'connecting' ? (
              <><div className="w-5 h-5 border-3 border-slate-300 border-t-white rounded-full animate-spin"></div> Priming Neural Buyer...</>
            ) : (
              <><ICONS.Play /> Enter Simulation</>
            )}
          </button>
          {status === 'error' && <p className="text-rose-500 text-sm font-bold">Failed to connect. Check mic permissions and API key.</p>}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
          {/* Simulation Stage */}
          <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
            {/* Pulsing Visualizer */}
            <div className="relative w-64 h-64 mb-10">
               <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-[ping_3s_infinite]"></div>
               <div className="absolute inset-4 bg-indigo-500/40 rounded-full animate-[ping_2s_infinite]"></div>
               <div className="absolute inset-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.5)]">
                  <div className="text-white scale-150"><ICONS.Brain /></div>
               </div>
            </div>
            
            <div className="text-center space-y-2 relative z-10">
               <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Neural Avatar: Active</p>
               <h5 className="text-white text-xl font-bold">{analysis.snapshot.role}</h5>
               <p className="text-slate-400 text-sm italic">"Challenge my priorities if you want the deal..."</p>
            </div>

            {/* Transcription Stream */}
            <div className="absolute bottom-8 inset-x-8 h-32 overflow-y-auto no-scrollbar space-y-3 mask-top">
              {currentTranscription.user && (
                <div className="flex justify-end animate-in slide-in-from-right-2 duration-300">
                  <p className="bg-indigo-600/20 text-indigo-100 text-xs py-2 px-4 rounded-2xl border border-indigo-500/30 max-w-[80%]">
                    {currentTranscription.user}
                  </p>
                </div>
              )}
              {currentTranscription.ai && (
                <div className="flex justify-start animate-in slide-in-from-left-2 duration-300">
                  <p className="bg-slate-800 text-slate-200 text-xs py-2 px-4 rounded-2xl border border-slate-700 max-w-[80%]">
                    {currentTranscription.ai}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Session Timeline */}
          <div className="bg-slate-50 rounded-[2.5rem] p-8 flex flex-col border border-slate-100 overflow-hidden">
            <h6 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div> Interaction Timeline
            </h6>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-10">
              {transcription.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 italic text-slate-400 text-sm">
                  Waiting for conversation to begin...
                </div>
              )}
              {transcription.map((turn, i) => (
                <div key={i} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[8px] font-black uppercase text-indigo-500 mb-1">Salesperson</p>
                    <p className="text-xs text-slate-700 leading-relaxed">"{turn.user}"</p>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                    <p className="text-[8px] font-black uppercase text-indigo-600 mb-1">{analysis.snapshot.role}</p>
                    <p className="text-xs text-indigo-900 leading-relaxed italic">"{turn.ai}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mask-top {
          mask-image: linear-gradient(to top, black 80%, transparent);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};
