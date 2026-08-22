import * as pdfjsLib from 'pdfjs-dist';
// Vite bundles the worker file itself and gives us a same-origin URL to it —
// no network dependency, no version drift against a CDN mirror.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Set pdfjs worker source. Previously this pointed at
// `https://cdnjs.cloudflare.com/.../pdf.worker.min.js` — pdfjs-dist 6.x only
// ships a `.mjs` worker, so that URL 404s and every PDF upload fails before
// any text extraction runs.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extracts raw text from uploaded syllabus & schedule files (.pdf, .docx, .xlsx, .xls, .txt, .md, .csv)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. PDF File Extraction
  if (fileName.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  }

  // 2. Word Document (.docx, .doc) Extraction
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return extractTextFromDocx(file);
  }

  // 3. Excel Spreadsheet (.xlsx, .xls) Extraction
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return extractTextFromExcel(file);
  }

  // 4. Text / Markdown / CSV / Default
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

/**
 * Extract text from PDF file page by page using PDF.js
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // PDF.js reports text as a flat run of items with no inherent line
    // breaks. Each item flags hasEOL when it's the last item on its visual
    // line, so we rebuild real line breaks from that instead of joining
    // everything into one giant space-separated blob — without this, every
    // downstream parser that works line-by-line (headers, tables, the
    // assignment schedule) sees an entire page as a single unparseable line.
    let pageString = '';
    for (const item of textContent.items as any[]) {
      if (typeof item.str !== 'string') continue;
      pageString += item.str;
      pageString += item.hasEOL ? '\n' : ' ';
    }
    pageTexts.push(pageString.trim());
  }

  return pageTexts.join('\n\n');
}

/**
 * Extract text from Word DOCX file using mammoth
 */
async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * Extract text from Excel spreadsheet (.xlsx, .xls) using SheetJS (XLSX)
 */
async function extractTextFromExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetTexts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert worksheet rows to plain text table format
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    sheetTexts.push(`Sheet: ${sheetName}\n${csvData}`);
  }

  return sheetTexts.join('\n\n');
}
