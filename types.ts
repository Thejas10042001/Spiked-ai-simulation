
export interface Citation {
  snippet: string;
  sourceFile: string;
}

export interface PriorityItem {
  text: string;
  citation: Citation;
}

export interface ObjectionItem {
  text: string;
  citation: Citation;
}

export interface DocumentEntity {
  name: string;
  type: string; // 'Person', 'Company', 'Metric', 'Date'
  context: string;
  citation: Citation;
}

export interface DocumentStructure {
  sections: string[];
  keyHeadings: string[];
  detectedTablesSummary: string;
}

export interface DocumentSummary {
  fileName: string;
  summary: string;
  strategicImpact: string;
  criticalInsights: string[];
}

export interface BuyerSnapshot {
  role: string;
  roleCitation: Citation;
  roleConfidence: number; // 0 to 1
  priorities: PriorityItem[];
  likelyObjections: ObjectionItem[];
  decisionStyle: string;
  decisionStyleCitation: Citation;
  decisionStyleConfidence: number; // 0 to 1
  riskTolerance: string;
  riskToleranceCitation: Citation;
  riskToleranceConfidence: number; // 0 to 1
  tone: string;
}

export interface QuestionPair {
  customerAsks: string;
  salespersonShouldRespond: string;
  reasoning: string;
  category: 'Business Value' | 'Technical' | 'Risk' | 'ROI' | 'Integration';
  citation: Citation;
}

export interface ObjectionPair {
  objection: string;
  realMeaning: string;
  strategy: string;
  exactWording: string;
  citation: Citation;
}

export interface StrategicQuestion {
  question: string;
  whyItMatters: string;
  citation: Citation;
}

export interface OpeningLine {
  text: string;
  label: string;
  citation: Citation;
}

export interface AnalysisResult {
  snapshot: BuyerSnapshot;
  documentInsights: {
    entities: DocumentEntity[];
    structure: DocumentStructure;
    summaries: DocumentSummary[];
  };
  openingLines: OpeningLine[];
  predictedQuestions: QuestionPair[];
  strategicQuestionsToAsk: StrategicQuestion[];
  objectionHandling: ObjectionPair[];
  toneGuidance: {
    wordsToUse: string[];
    wordsToAvoid: string[];
    sentenceLength: string;
    technicalDepth: string;
  };
  finalCoaching: {
    dos: string[];
    donts: string[];
    finalAdvice: string;
  };
}

export interface UploadedFile {
  name: string;
  content: string;
  type: string;
  status: 'processing' | 'ready' | 'error' | 'ocr';
}

export type CustomerPersonaType = 'Balanced' | 'Technical' | 'Financial' | 'Business Executives';

export interface MeetingContext {
  sellerCompany: string;
  sellerNames: string;
  clientCompany: string;
  clientNames: string;
  targetProducts: string;
  productDomain: string;
  meetingFocus: string;
  persona: CustomerPersonaType;
  answerStyles: string[];
  executiveSnapshot: string;
  strategicKeywords: string[];
  baseSystemPrompt: string;
}
