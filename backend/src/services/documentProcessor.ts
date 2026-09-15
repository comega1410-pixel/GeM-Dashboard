import fs from 'fs';
import path from 'path';
// @ts-ignore - pdf-parse v2 exports PDFParse
import { PDFParse } from 'pdf-parse';
import { DocumentType } from '../types';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  totalPages: number;
  fullText: string;
  pages: ParsedPage[];
  ocrUsed: boolean;
  extractionConfidence: number;
  detectedType: DocumentType;
  processingErrors?: string;
}

/**
 * Intelligent Document Classifier based on filename and extracted textual cues.
 */
export function classifyDocument(filename: string, textSnippet: string = ''): DocumentType {
  const lower = (filename + ' ' + textSnippet.slice(0, 1000)).toLowerCase();

  if (lower.includes('tender') || lower.includes('bid_doc') || lower.includes('biddocument') || lower.includes('gem_tender') || lower.includes('bid specification')) {
    return 'BID_DOCUMENT';
  }
  if (lower.includes('oem') || lower.includes('manufacturer') || lower.includes('authorization') || lower.includes('maf')) {
    return 'OEM_AUTHORIZATION';
  }
  if (lower.includes('gst') || lower.includes('gstin') || lower.includes('tax invoice')) {
    return 'GST_CERTIFICATE';
  }
  if (lower.includes('financial') || lower.includes('balance sheet') || lower.includes('turnover') || lower.includes('ca cert') || lower.includes('profit and loss')) {
    return 'FINANCIAL_STATEMENT';
  }
  if (lower.includes('experience') || lower.includes('completion') || lower.includes('client certificate')) {
    return 'EXPERIENCE_CERTIFICATE';
  }
  if (lower.includes('work order') || lower.includes('purchase order') || lower.includes('po ') || lower.includes('p.o.')) {
    return 'WORK_ORDER';
  }
  if (lower.includes('iso') || lower.includes('bis') || lower.includes('compliance cert') || lower.includes('quality cert')) {
    return 'ISO_CERTIFICATE';
  }
  if (lower.includes('spec') || lower.includes('technical') || lower.includes('datasheet') || lower.includes('data sheet')) {
    return 'TECHNICAL_SPEC';
  }
  if (lower.includes('warranty') || lower.includes('guarantee')) {
    return 'WARRANTY_DOCUMENT';
  }
  if (lower.includes('affidavit') || lower.includes('declaration') || lower.includes('undertaking') || lower.includes('non-blacklisting')) {
    return 'AFFIDAVIT_DECLARATION';
  }

  return 'OTHER';
}

/**
 * Extract text from a PDF file with page-level tracking and classification.
 */
export async function extractTextFromPDF(filePath: string, originalName: string = ''): Promise<ParsedDocument> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      totalPages: 0,
      fullText: '',
      pages: [],
      ocrUsed: false,
      extractionConfidence: 0,
      detectedType: 'OTHER',
      processingErrors: `File not found at ${filePath}`,
    };
  }

  const dataBuffer = fs.readFileSync(absolutePath);

  try {
    const parser = new (PDFParse as any)({ data: dataBuffer });
    const data = await parser.getText();

    const fullText = data.text || '';
    const totalPages = data.total || data.pages?.length || 1;

    let pages: ParsedPage[] = [];
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      pages = data.pages.map((p: any, idx: number) => ({
        pageNumber: typeof p.num === 'number' ? p.num : idx + 1,
        text: (p.text || '').trim(),
      }));
    } else {
      pages = splitIntoPages(fullText, totalPages);
    }

    const ocrUsed = fullText.trim().length < 50;
    // Calculate extraction confidence based on text length and density
    const confidence = ocrUsed ? 0.4 : Math.min(0.98, 0.7 + Math.min(fullText.length / 5000, 0.28));
    const detectedType = classifyDocument(originalName || path.basename(filePath), fullText);

    return {
      totalPages,
      fullText,
      pages,
      ocrUsed,
      extractionConfidence: Number(confidence.toFixed(2)),
      detectedType,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      totalPages: 0,
      fullText: '',
      pages: [],
      ocrUsed: false,
      extractionConfidence: 0,
      detectedType: classifyDocument(originalName || path.basename(filePath)),
      processingErrors: (error as Error).message,
    };
  }
}

function splitIntoPages(text: string, numPages: number): ParsedPage[] {
  const formFeedSplit = text.split('\f');

  if (formFeedSplit.length >= numPages) {
    return formFeedSplit.slice(0, numPages).map((pageText, i) => ({
      pageNumber: i + 1,
      text: pageText.trim(),
    }));
  }

  if (numPages <= 1) {
    return [{ pageNumber: 1, text: text.trim() }];
  }

  const avgCharsPerPage = Math.ceil(text.length / numPages);
  const pages: ParsedPage[] = [];

  for (let i = 0; i < numPages; i++) {
    const start = i * avgCharsPerPage;
    const end = Math.min(start + avgCharsPerPage, text.length);
    pages.push({
      pageNumber: i + 1,
      text: text.slice(start, end).trim(),
    });
  }

  return pages;
}
