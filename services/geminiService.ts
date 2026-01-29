import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Advanced Semantic OCR using Gemini 3 Pro.
 * Handles messy scans, handwriting, and complex layouts.
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
            2. Maintain structural layout where possible (headings, bullet points).
            3. If tables are present, reconstruct them using Markdown format.
            4. If there is handwriting, use your reasoning to transcribe it accurately.
            5. If text is blurry, provide your best grounded inference.
            6. Output ONLY the extracted text. Do not provide commentary.` 
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
  citations: { snippet: string; source: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-pro-preview';
  
  // Enforce the requested styles in the prompt
  const requestedStyles = context.answerStyles.length > 0 
    ? `The user has specifically requested the following strategic response components: ${context.answerStyles.join(', ')}.`
    : "Follow standard strategic consulting format.";

  const prompt = `MEETING DETAILS:
  Seller: ${context.sellerNames} at ${context.sellerCompany}
  Client: ${context.clientNames} at ${context.clientCompany}
  Focus: ${context.meetingFocus}
  Solution Domain: ${context.productDomain}
  Snapshot: ${context.executiveSnapshot}

  TASK: Perform HIGH-FIDELITY COGNITIVE GROUNDING to answer the question using the source documents.
  
  ${requestedStyles}

  FORMATTING RULES FOR THE "answer" STRING (CRITICAL):
  You MUST use these exact block headers to structure the output. Bold the headers.
  
  1. If "Concise Answer" is active:
     **CONCISE EXECUTIVE SUMMARY**
     [A high-density, professional direct answer to the question.]

  2. If "Sales Points" is active:
     **SALES STRATEGY POINTS**
     [Bullet points of actionable conversation hooks and value levers.]

  3. If "Define Technical Terms" is active:
     **TECHNICAL GLOSSARY**
     [Definitions of jargon from the docs, explained for a ${context.persona} persona.]

  4. If "Competitive Comparison" is active:
     **COMPETITIVE LANDSCAPE**
     [Side-by-side logic of our wedge vs competitors based on document evidence.]

  5. If "Anticipated Customer Questions" is active:
     **ANTICIPATED FRICTION**
     [Predict 2-3 tough questions this specific client will ask based on document gaps.]

  STYLE RULES:
  - BOLD (**) critical data points and impact statements.
  - ITALICIZE (*) psychological nuances.
  - Tone: Strategic, Grounded, and Concise.

  QUESTION: ${question}
  
  --- SOURCE DOCUMENTS ---
  ${filesContent || "No documents uploaded yet."}
  
  Return your response ONLY as a JSON object with the specified schema.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `ACT AS: Avi from Spiked (Sales Strategy Expert). Persona: ${context.persona}. Use cognitive analysis to infer buyer psychology from document evidence.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            briefExplanation: { type: Type.STRING },
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
    console.error("Cognitive search failed:", error);
    throw new Error("Could not retrieve a grounded answer.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Based on the following meeting context and source documents, suggest 3 highly strategic and nuanced questions that a salesperson should ask our AI to uncover value mapping or deal friction.
  
  CONTEXT:
  Client: ${context.clientCompany}
  Persona: ${context.persona}
  Focus: ${context.meetingFocus}
  
  --- DOCUMENTS ---
  ${filesContent.slice(0, 5000)} ... [truncated]
  
  Return ONLY a JSON array of 3 strings.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [
      `What is the ROI for ${context.clientCompany}?`,
      `How do we address ${context.persona} concerns?`,
      `What are the top 3 value drivers?`
    ];
  }
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
  Provide a concise, professional, and coaching-oriented explanation. Speak as a senior sales mentor.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior sales consultant providing verbal coaching."
      }
    });
    return response.text || "I'm sorry, I couldn't formulate an explanation for that.";
  } catch (error) {
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
    return null;
  }
}

export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const modelName = 'gemini-3-pro-preview';
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
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] },
          summaries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fileName: { type: Type.STRING },
                summary: { type: Type.STRING, description: "Highly concise executive summary focused ONLY on sales-relevant themes." },
                strategicImpact: { type: Type.STRING, description: "One sentence on how this specific document changes the sales approach." },
                criticalInsights: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Max 3-5 high-impact bullet points of critical intel." }
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

  const prompt = `Perform a high-fidelity sales intelligence analysis for: ${context.clientCompany}. 
  Meeting Context: ${context.meetingFocus}.
  Solution Domain: ${context.productDomain}.
  
  TASK: Synthesize the provided documents into a strategic weapon.
  ENHANCED SUMMARIZATION RULES:
  1. For the "summaries" field, do NOT provide generic summaries. 
  2. Focus exclusively on identifying: Unstated budget signals, Technical bottlenecks, Strategic priorities, and Decision-maker influence.
  3. Keep the "summary" string under 300 characters.
  4. Ensure "strategicImpact" is a single, hard-hitting sentence for the salesperson.

  --- GROUNDING DOCUMENTS --- 
  ${filesContent}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Cognitive AI Sales Intelligence Agent. Persona: ${context.persona}. Target Solution: ${context.targetProducts}. ${context.baseSystemPrompt}. Ground every insight in document text.`,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 12000 }
      },
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    throw new Error(`Intelligence Analysis Failed: ${error.message}`);
  }
}

// --- VIDEO GENERATION EXPORTS ---

export interface VideoStoryboard {
  id: string;
  title: string;
  description: string;
  angle: string;
  veoPrompt: string;
}

/**
 * Conceptualizes video strategy based on AnalysisResult using Gemini 3 Flash.
 */
export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Based on the following sales analysis for a ${analysis.snapshot.role}, generate 3 distinct cinematic video storyboard concepts for a "Sales Explainer" video.
  
  ANALYSIS:
  ${JSON.stringify(analysis, null, 2)}
  
  For each concept, provide:
  - id: a unique string
  - title: a catchy title
  - description: a short description of the visual style and flow
  - angle: the strategic focus (e.g., "ROI", "Trust", "Innovation")
  - veoPrompt: a highly detailed visual prompt for a video generation model (Veo). Use vivid, cinematic language. Include camera movements, lighting, and specific visual metaphors.
  
  Return ONLY a JSON array of 3 objects matching the VideoStoryboard interface.`;

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
  } catch (error) {
    console.error("Storyboard generation failed:", error);
    return [];
  }
}

/**
 * Initiates video generation using Veo 3.1.
 * Creates a new GoogleGenAI instance to ensure the latest selected API key is used.
 */
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

/**
 * Polls for the status of a video generation operation.
 * Creates a new GoogleGenAI instance to ensure the latest selected API key is used.
 */
export async function getVideoStatus(operation: any) {
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await veoAi.operations.getVideosOperation({ operation: operation });
}
