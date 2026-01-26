
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const modelName = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Extract all text from this image exactly as written." },
        ],
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
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
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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
}

export async function generateExplanation(question: string, context: AnalysisResult): Promise<string> {
  const prompt = `Based on the following sales analysis:
  ${JSON.stringify(context, null, 2)}
  
  Please answer this salesperson's question about the strategy: "${question}"
  Provide a concise, professional, and coaching-oriented explanation in about 2-3 sentences. Speak as a senior sales mentor.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior sales consultant providing verbal coaching. Keep it brief and high-impact."
      }
    });
    return response.text || "I'm sorry, I couldn't formulate an explanation for that.";
  } catch (error) {
    console.error("Explanation generation failed:", error);
    return "I encountered an error while trying to analyze that specific question.";
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
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    return decode(base64Audio);
  } catch (error) {
    console.error("Audio generation failed:", error);
    return null;
  }
}

export async function analyzeSalesContext(filesContent: string): Promise<AnalysisResult> {
  // Use Flash for better quota availability and speed
  const modelName = 'gemini-3-flash-preview';
  const citationSchema = {
    type: Type.OBJECT,
    properties: {
      snippet: { type: Type.STRING },
      sourceFile: { type: Type.STRING },
    },
    required: ["snippet", "sourceFile"],
  };

  const systemInstruction = `You are a Cognitive AI Sales Intelligence Agent. Your goal is to provide deeply grounded strategic advice for sales professionals. 
  When providing opening lines, ensure you offer 2-3 distinct options, each with a clear label describing its strategic intent (e.g., 'The Strategic Hook', 'The Direct Outcome approach', 'The Value-First approach'). 
  Structure your entire response as a single valid JSON object adhering strictly to the provided schema.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      snapshot: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          roleCitation: citationSchema,
          priorities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          likelyObjections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          decisionStyle: { type: Type.STRING },
          decisionStyleCitation: citationSchema,
          riskTolerance: { type: Type.STRING },
          riskToleranceCitation: citationSchema,
          tone: { type: Type.STRING },
        },
        required: ["role", "roleCitation", "priorities", "likelyObjections", "decisionStyle", "decisionStyleCitation", "riskTolerance", "riskToleranceCitation", "tone"],
      },
      documentInsights: {
        type: Type.OBJECT,
        properties: {
          entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING }, context: { type: Type.STRING }, citation: citationSchema }, required: ["name", "type", "context", "citation"] } },
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] }
        },
        required: ["entities", "structure"]
      },
      openingLines: { 
        type: Type.ARRAY, 
        minItems: 2,
        maxItems: 3,
        items: { 
          type: Type.OBJECT, 
          properties: { 
            text: { type: Type.STRING }, 
            label: { type: Type.STRING, description: "A concise label for the opener style (e.g., 'The Strategic Hook')" },
            citation: citationSchema 
          }, 
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

  const prompt = `Analyze the following sales-related documents and provide a complete conversation strategy. 
  Ensure you provide exactly 2 to 3 very distinct opening lines grounded in the source text. 
  --- DOCUMENTS --- ${filesContent} --- END DOCUMENTS ---`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 12000 }
      },
    });
    return JSON.parse(response.text || "{}") as AnalysisResult;
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("Quota exceeded. The Gemini API Free Tier has limited requests. Please wait a minute and try again, or use a smaller document.");
    }
    throw new Error(`Intelligence Analysis Failed: ${error.message}`);
  }
}
