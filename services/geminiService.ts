
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * High-speed analysis for real-time sales strategy.
 */
export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  // Use gemini-3-flash-preview for maximum speed and sub-second latency
  const modelName = 'gemini-3-flash-preview';
  
  const citationSchema = {
    type: Type.OBJECT,
    properties: {
      snippet: { type: Type.STRING },
      sourceFile: { type: Type.STRING },
    },
    required: ["snippet", "sourceFile"],
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      snapshot: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          roleCitation: citationSchema,
          roleConfidence: { type: Type.NUMBER },
          priorities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          likelyObjections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          decisionStyle: { type: Type.STRING },
          decisionStyleCitation: citationSchema,
          decisionStyleConfidence: { type: Type.NUMBER },
          riskTolerance: { type: Type.STRING },
          riskToleranceCitation: citationSchema,
          riskToleranceConfidence: { type: Type.NUMBER },
          tone: { type: Type.STRING },
        },
        required: ["role", "roleCitation", "roleConfidence", "priorities", "likelyObjections", "decisionStyle", "decisionStyleCitation", "decisionStyleConfidence", "riskTolerance", "riskToleranceCitation", "riskToleranceConfidence", "tone"],
      },
      documentInsights: {
        type: Type.OBJECT,
        properties: {
          entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING }, context: { type: Type.STRING }, citation: citationSchema }, required: ["name", "type", "context", "citation"] } },
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] },
          summaries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fileName: { type: Type.STRING },
                summary: { type: Type.STRING },
                strategicImpact: { type: Type.STRING },
                criticalInsights: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["fileName", "summary", "strategicImpact", "criticalInsights"]
            }
          }
        },
        required: ["entities", "structure", "summaries"]
      },
      openingLines: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { text: { type: Type.STRING }, label: { type: Type.STRING }, citation: citationSchema }, 
          required: ["text", "label", "citation"] 
        } 
      },
      predictedQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { customerAsks: { type: Type.STRING }, salespersonShouldRespond: { type: Type.STRING }, reasoning: { type: Type.STRING }, category: { type: Type.STRING }, citation: citationSchema }, required: ["customerAsks", "salespersonShouldRespond", "reasoning", "category", "citation"] } },
      strategicQuestionsToAsk: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, whyItMatters: { type: Type.STRING }, citation: citationSchema }, required: ["question", "whyItMatters", "citation"] } },
      objectionHandling: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { objection: { type: Type.STRING }, realMeaning: { type: Type.STRING }, strategy: { type: Type.STRING }, exactWording: { type: Type.STRING }, citation: citationSchema }, required: ["objection", "realMeaning", "strategy", "exactWording", "citation"] } },
      toneGuidance: { type: Type.OBJECT, properties: { wordsToUse: { type: Type.ARRAY, items: { type: Type.STRING } }, wordsToAvoid: { type: Type.ARRAY, items: { type: Type.STRING } }, sentenceLength: { type: Type.STRING }, technicalDepth: { type: Type.STRING } }, required: ["wordsToUse", "wordsToAvoid", "sentenceLength", "technicalDepth"] },
      finalCoaching: { type: Type.OBJECT, properties: { dos: { type: Type.ARRAY, items: { type: Type.STRING } }, donts: { type: Type.ARRAY, items: { type: Type.STRING } }, finalAdvice: { type: Type.STRING } }, required: ["dos", "donts", "finalAdvice"] }
    },
    required: ["snapshot", "documentInsights", "openingLines", "predictedQuestions", "strategicQuestionsToAsk", "objectionHandling", "toneGuidance", "finalCoaching"]
  };

  const prompt = `ACT AS: Cognitive AI Sales Intelligence Agent.
  
  CONTEXT:
  Target Client: ${context.clientCompany}
  Meeting Goal: ${context.meetingFocus}
  Product: ${context.targetProducts}

  --- SOURCE DOCUMENTS ---
  ${filesContent}
  
  Return analysis as JSON. Ground every strategic point in documentary evidence.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a world-class sales analyst. Ground everything in documentary proof. Be extremely precise and concise.`,
        responseMimeType: "application/json",
        responseSchema,
      },
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    throw new Error(`Analysis Failed: ${error.message}`);
  }
}

export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const modelName = 'gemini-3-flash-preview'; 
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `High-fidelity OCR extraction. Layout preserving.` },
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
  citations: { snippet: string; source: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `QUESTION: ${question}
  CLIENT: ${context.clientCompany}
  --- SOURCE DOCUMENTS ---
  ${filesContent}
  
  Analyze and provide a strategic sales-focused answer grounded in the documents. 
  ALWAYS include a 'briefExplanation' which is a 2-sentence executive summary of the core tactical answer.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Cognitive AI Sales Intelligence Agent. Focus on logical justification. Ground everything in documents.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            briefExplanation: { type: Type.STRING, description: "A high-density 2-sentence executive summary of the tactical answer." },
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
          required: ["answer", "briefExplanation", "citations", "reasoningChain"]
        }
      }
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    return JSON.parse(text);
  } catch (error: any) {
    throw new Error("Cognitive search failed.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 strategic sales questions for ${context.clientCompany} based on provided documentation.`;
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return ["What is the primary technical hurdle?", "How does this align with growth?", "What is the timeline?"];
  }
}

export interface VideoStoryboard {
  id: string;
  title: string;
  angle: string;
  description: string;
  veoPrompt: string;
}

export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Create 3 video concepts for: ${analysis.snapshot.role}. Tone: ${analysis.snapshot.tone}.`;
  try {
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
              angle: { type: Type.STRING },
              description: { type: Type.STRING },
              veoPrompt: { type: Type.STRING }
            },
            required: ["id", "title", "angle", "description", "veoPrompt"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
}

export async function startVideoGeneration(prompt: string, aspectRatio: '16:9' | '9:16') {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await dynamicAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });
}

export async function getVideoStatus(operationId: any) {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await dynamicAi.operations.getVideosOperation({ operation: operationId });
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
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
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on analysis: ${JSON.stringify(context, null, 2)}\nAnswer: "${question}"`,
    });
    return response.text || "";
  } catch (error) {
    return "";
  }
}

export async function generatePitchAudio(text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await dynamicAi.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    return decode(base64Audio);
  } catch (error) {
    return null;
  }
}
