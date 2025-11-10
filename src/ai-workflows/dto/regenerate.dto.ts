import { PdfReference } from './newsletter.dto';

export interface ScrapReference {
  id: string;
  title: string;
  url: string;
  content: string;
  userComment?: string | null;
}

export interface RegenerateArticleInput {
  previousTitle: string;
  previousContent: string;
  userPrompt: string;
  topic?: string | null;
  keyInsight?: string | null;
  existingScraps?: ScrapReference[] | null;
  addedScraps?: ScrapReference[] | null;
  removedScraps?: ScrapReference[] | null;
  additionalScraps?: ScrapReference[] | null;
  additionalPdfs?: PdfReference[] | null;
  writingStyleExamples?: string[] | null;
  generationParams?: string | null;
}

export interface RegenerateArticleOutput {
  title: string;
  content: string;
  changesSummary: string;
}

