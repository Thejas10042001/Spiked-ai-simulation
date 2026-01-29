
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Advanced Semantic OCR using Gemini 3 Pro.
 */
export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const modelName = 'gemini-3-pro-preview'; 
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { 
            text: `Act as a high-precision Cognitive OCR engine. 
            TRANSCRIPTION TASK:
            1. Extract ALL text from this image exactly as written.
            2. Maintain structural layout.
            3. Output ONLY the extracted text.` 
          },
        ],
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
  }
}

export interface CognitiveSearchResult {
  answer: string;
  briefExplanation: string;
  articularSoundbite: string; // Verbatim one-liner for the seller
  psychologicalProjection: {
    buyerFear: string;
    buyerIncentive: string;
    strategicLever: string;
  };
  citations: { snippet: string; source: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-pro-preview';
  
  const prompt = `MEETING INTELLIGENCE CONTEXT:
  Seller: ${context.sellerNames} (${context.sellerCompany})
  Client Stakeholder: ${context.clientNames} (${context.clientCompany})
  Target Persona: ${context.persona} (This stakeholder is driven by ${context.persona === 'Financial' ? 'ROI and risk' : context.persona === 'Technical' ? 'stability and performance' : 'strategic growth'}).
  Meeting Focus: ${context.meetingFocus}
  Solution: ${context.targetProducts}

  TASK: Synthesize a COGNITIVE ARTICULAR RESPONSE. 
  Don't just summarize; simulate how this stakeholder will perceive the information emotionally and professionally.

  DOCUMENT SOURCE DATA:
  ${filesContent || "No documents provided."}

  QUESTION: ${question}

  RESPONSE REQUIREMENTS:
  1. "answer": A detailed, grounded analysis using the "Sales Strategy Points" and "Technical Glossary" blocks as needed.
  2. "briefExplanation": A 2-sentence high-density executive summary.
  3. "articularSoundbite": A punchy, 10-word verbatim sentence the salesperson should say right now to sound highly articular.
  4. "psychologicalProjection": Map the unstated subtext. What is this buyer AFRAID of in this answer? What is their INCENTIVE?

  Return as JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are Avi from Spiked, a world-class Sales Strategist. Your goal is to make the salesperson sound like the smartest person in the room by providing "Cognitive Articulation" — the ability to speak to the buyer's hidden professional motivations.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            briefExplanation: { type: Type.STRING },
            articularSoundbite: { type: Type.STRING },
            psychologicalProjection: {
              type: Type.OBJECT,
              properties: {
                buyerFear: { type: Type.STRING },
                buyerIncentive: { type: Type.STRING },
                strategicLever: { type: Type.STRING }
              },
              required: ["buyerFear", "buyerIncentive", "strategicLever"]
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  snippet: { type: Type.STRING },
                  source: { type: Type.STRING }
                },
                required: ["snippet", "source"]
              }
            },
            reasoningChain: {
              type: Type.OBJECT,
              properties: {
                painPoint: { type: Type.STRING },
                capability: { type: Type.STRING },
                strategicValue: { type: Type.STRING }
              },
              required: ["painPoint", "capability", "strategicValue"]
            }
          },
          required: ["answer", "briefExplanation", "articularSoundbite", "psychologicalProjection", "citations", "reasoningChain"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error("Cognitive articulation failed.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 strategic questions to ask our AI for a ${context.persona} stakeholder at ${context.clientCompany} regarding ${context.meetingFocus}. Return as JSON array.`;
  const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: { responseMimeType: "application/json" } });
  return JSON.parse(response.text || "[]");
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export async function generateExplanation(question: string, context: AnalysisResult): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain this sales strategy question: "${question}" based on: ${JSON.stringify(context.snapshot)}`,
  });
  return response.text || "";
}

export async function generatePitchAudio(text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ? decode(base64Audio) : null;
}

export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const modelName = 'gemini-3-pro-preview';
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Analyze this context for a ${context.persona} stakeholder: ${filesContent}`,
    config: {
      systemInstruction: `You are a Cognitive AI Sales Strategist. Analyze for unstated psychological drivers.`,
      responseMimeType: "application/json"
    },
  });
  return JSON.parse(response.text || "{}") as AnalysisResult;
}

// FIX: Added VideoStoryboard interface to satisfy VideoGenerator component imports.
export interface VideoStoryboard {
  id: string;
  title: string;
  description: string;
  angle: string;
  veoPrompt: string;
}

// FIX: Added generateVideoStoryboard to conceptualize cinematic visuals from analysis results.
export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Based on this sales analysis of a ${analysis.snapshot.role}, generate 3 distinct cinematic video concepts for a sales explainer. 
  The concepts should address their priorities: ${analysis.snapshot.priorities.map(p => p.text).join(', ')}.
  Return exactly 3 concepts in JSON format with fields: id, title, description, angle, veoPrompt. 
  The 'veoPrompt' should be a detailed visual prompt for a video generation model.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            angle: { type: Type.STRING },
            veoPrompt: { type: Type.STRING }
          },
          required: ["id", "title", "description", "angle", "veoPrompt"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

// FIX: Added startVideoGeneration using the recommended veo-3.1-fast-generate-preview model.
// IMPORTANT: Per guidelines, a new GoogleGenAI instance is created right before the API call to ensure latest API key.
export async function startVideoGeneration(prompt: string, aspectRatio: '16:9' | '9:16') {
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await veoAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });
}

// FIX: Added getVideoStatus to poll the long-running video generation operation.
// IMPORTANT: Per guidelines, a new GoogleGenAI instance is created right before the API call.
export async function getVideoStatus(operation: any) {
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await veoAi.operations.getVideosOperation({ operation: operation });
}
