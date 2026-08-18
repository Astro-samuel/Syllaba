import React, { useState } from 'react';
import { ExtractionResult, PresetSyllabus } from '../types';
import { PRESET_SYLLABI, parseSyllabusText } from '../utils/aiParser';
import { extractTextFromFile } from '../utils/documentExtractor';
import { UploadCloud, FileText, Sparkles, Key, CheckCircle2, ArrowRight, FileCheck, Calendar, FileSpreadsheet } from 'lucide-react';

interface SyllabusUploaderProps {
  onExtractionComplete: (result: ExtractionResult, color: string) => void;
}

export const SyllabusUploader: React.FC<SyllabusUploaderProps> = ({ onExtractionComplete }) => {
  const [inputText, setInputText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#8B5CF6');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [uploadMode, setUploadMode] = useState<'syllabus' | 'class_schedule'>('syllabus');

  const colors = [
    { name: 'Vibrant Amethyst', value: '#8B5CF6' },
    { name: 'Sunset Amber', value: '#F59E0B' },
    { name: 'Spring Lime', value: '#84CC16' },
    { name: 'Ocean Cyan', value: '#06B6D4' },
    { name: 'Vibrant Crimson', value: '#F43F5E' },
  ];

  const handleStartParsing = async (textToParse: string, courseColor = selectedColor) => {
    if (!textToParse.trim()) return;

    setIsProcessing(true);
    setProcessingStep(1);

    const timer1 = setTimeout(() => setProcessingStep(2), 250);
    const timer2 = setTimeout(() => setProcessingStep(3), 500);

    try {
      const result = await parseSyllabusText(textToParse, apiKey);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsProcessing(false);
      setProcessingStep(0);
      onExtractionComplete(result, courseColor);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  const handlePresetSelect = (preset: PresetSyllabus) => {
    setInputText(preset.rawText);
    setSelectedColor(preset.color);
    handleStartParsing(preset.rawText, preset.color);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStep(1);

    try {
      const text = await extractTextFromFile(file);
      setInputText(text);
      await handleStartParsing(text);
    } catch (err) {
      console.error('File extraction error:', err);
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-caplen-navy shadow-sm mb-3 border border-slate-200/60">
          <Sparkles className="h-3.5 w-3.5 text-vibrant-purpleAccent" />
          <span>AI Syllabus & Class Schedule Extraction</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-caplen-navy">
          Import Course Syllabus or Class Schedule
        </h1>
        <p className="mt-2 text-xs font-medium text-caplen-muted max-w-md mx-auto">
          Upload any PDF, Word, Excel (.xlsx), or text file below to automatically extract exams, assignments, labs, and class meeting schedules.
        </p>

        {/* Mode Selector */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setUploadMode('syllabus')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all border font-heading ${
              uploadMode === 'syllabus'
                ? 'bg-caplen-navy text-white border-caplen-navy shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Course Syllabus</span>
          </button>
          <button
            onClick={() => setUploadMode('class_schedule')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all border font-heading ${
              uploadMode === 'class_schedule'
                ? 'bg-caplen-navy text-white border-caplen-navy shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-vibrant-limeAccent" />
            <span>Class Timetable & Schedule</span>
          </button>
        </div>
      </div>

      {/* Preset Syllabi Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-caplen-muted uppercase tracking-wider">
            1-Click Sample Syllabi
          </h3>
          <span className="text-[11px] font-semibold text-vibrant-purpleText flex items-center gap-1 bg-vibrant-purple px-2.5 py-0.5 rounded-full border border-vibrant-purpleBorder">
            <FileCheck className="h-3 w-3" /> Test File Included
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_SYLLABI.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              disabled={isProcessing}
              className="text-left p-5 rounded-3xl caplen-card-interactive flex flex-col justify-between h-44 relative group border border-slate-200/80 hover:border-vibrant-purpleBorder"
            >
              <div>
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mb-2 inline-block shadow-xs"
                  style={{ backgroundColor: `${preset.color}20`, color: preset.color, border: `1px solid ${preset.color}40` }}
                >
                  {preset.code}
                </span>
                <h4 className="font-heading text-sm font-extrabold text-caplen-navy line-clamp-2 group-hover:text-vibrant-purpleText transition-colors">
                  {preset.title}
                </h4>
                <p className="text-xs text-caplen-muted mt-1.5 line-clamp-2">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-caplen-navy pt-2 border-t border-slate-100">
                <span>Parse Syllabus</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-vibrant-purpleAccent" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="caplen-card p-8 relative">
        {/* Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-20 rounded-3xl bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-caplen-navy text-vibrant-limeAccent flex items-center justify-center mb-4 shadow-lg animate-bounce">
              <Sparkles className="h-8 w-8 animate-spin" />
            </div>
            <h3 className="font-heading text-lg font-extrabold text-caplen-navy mb-2">
              Analyzing {uploadMode === 'class_schedule' ? 'Class Schedule' : 'Syllabus'}...
            </h3>
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden mb-4 border border-slate-200">
              <div
                className="bg-caplen-navy h-full transition-all duration-300"
                style={{ width: `${processingStep * 33.3}%` }}
              />
            </div>
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-caplen-muted">
              <div className={`flex items-center gap-2 ${processingStep >= 1 ? 'text-emerald-600 font-bold' : ''}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Reading document text & tables</span>
              </div>
              <div className={`flex items-center gap-2 ${processingStep >= 2 ? 'text-emerald-600 font-bold' : ''}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Extracting 100% of dates, times, exams & meeting schedule</span>
              </div>
              <div className={`flex items-center gap-2 ${processingStep >= 3 ? 'text-emerald-600 font-bold' : ''}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Formatting timeline schedule</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Drag-Drop */}
          <div className="flex flex-col justify-center items-center border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-slate-100/80 hover:border-vibrant-purpleBorder transition-all cursor-pointer relative group">
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx,.xlsx,.xls,.md,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <div className="h-12 w-12 rounded-2xl bg-caplen-navy text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
              <UploadCloud className="h-6 w-6 text-vibrant-limeAccent" />
            </div>
            <h4 className="text-sm font-extrabold text-caplen-navy font-heading">
              Upload File (PDF, Word, Excel, CSV)
            </h4>
            <p className="text-xs text-caplen-muted mt-1 leading-relaxed">
              Drag & drop PDF, Word (.docx), Excel spreadsheet (.xlsx, .xls), or text schedule file
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              <span>Excel & CSV Supported</span>
            </div>
          </div>

          {/* Color Selector */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-xs font-bold text-caplen-muted mb-3 uppercase tracking-wider">
                Select Course Badge Color
              </label>
              <div className="flex items-center gap-3">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setSelectedColor(c.value)}
                    className={`h-9 w-9 rounded-2xl border-2 transition-all shadow-xs ${
                      selectedColor === c.value
                        ? 'border-caplen-navy scale-110 shadow-md ring-2 ring-offset-2 ring-slate-300'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="text-xs text-slate-500 hover:text-caplen-navy flex items-center gap-1.5 transition-colors font-medium"
              >
                <Key className="h-3.5 w-3.5 text-caplen-navy" />
                <span>Custom API Key (Optional)</span>
              </button>

              {showApiKeyInput && (
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none focus:bg-white"
                />
              )}
            </div>
          </div>
        </div>

        {/* Text Area */}
        <div className="mt-6">
          <label className="block text-xs font-bold text-caplen-navy mb-2 uppercase tracking-wider flex items-center gap-2 font-heading">
            <FileText className="h-3.5 w-3.5 text-vibrant-purpleText" />
            <span>Or Paste Syllabus or Class Schedule Text Direct</span>
          </label>
          <textarea
            rows={6}
            placeholder={
              uploadMode === 'class_schedule'
                ? "Paste class timetable text here (e.g. CS 101 Lecture MWF 10:00 AM - 11:15 AM in Room 204)..."
                : "Paste syllabus text here..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full rounded-2xl bg-slate-50/70 border border-slate-200 p-4 text-xs font-mono text-caplen-navy placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-vibrant-purpleAccent/20 transition-all"
          />
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => handleStartParsing(inputText)}
            disabled={!inputText.trim() || isProcessing}
            className="flex items-center gap-2 rounded-full bg-caplen-navy px-8 py-3.5 text-xs font-extrabold text-white shadow-lg hover:bg-caplen-navyHover transition-all disabled:opacity-50 font-heading tracking-wide"
          >
            <Sparkles className="h-4 w-4 text-vibrant-limeAccent" />
            <span>EXTRACT {uploadMode === 'class_schedule' ? 'CLASS SCHEDULE' : 'SYLLABUS'} WITH AI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
