import { z } from 'zod';

export interface ScrapData {
  id: string;
  title: string;
  url: string;
  content: string;
  userComment?: string | null;
}

export interface ScrapWithComment {
  scrap: ScrapData;
  userComment?: string | null;
}

export interface SectionTemplate {
  title: string;
  insight?: string;
  children?: SectionTemplate[];
}

export interface PdfReference {
  url?: string;
  usagePrompt?: string;
  aiContent?: string;
}

export interface Feedback {
  generatedNewsletter: string;
  feedback: string;
}

export interface NewsletterWorkflowInput {
  topic: string;
  keyInsight?: string | null;
  scrapsWithComments?: ScrapWithComment[];
  generationParams?: string | null;
  articleStructureTemplate?: SectionTemplate[];
  writingStyleExampleContents?: string[];
  pdfUrlsWithPrompts?: PdfReference[];
  feedbacks?: Feedback[];
}

export interface NewsletterWorkflowOutput {
  title: string;
  content: string;
  analysisReason: string;
  warnings?: string[];
}

export interface PageStructureSection {
  title: string;
  level: number;
  parent_index?: number | null;
}

export interface PageStructureAnalysis {
  sections: PageStructureSection[];
}

export const PageStructureSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      level: z.number(),
      parent_index: z.number().nullable().optional(),
    }),
  ),
});
