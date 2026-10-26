import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Link as LinkIcon, 
  List, 
  ListOrdered, 
  RemoveFormatting, 
  ExternalLink, 
  Edit3, 
  Unlink, 
  Check, 
  X,
  FileSpreadsheet,
  Globe,
  Sparkles,
  Info
} from 'lucide-react';
import { renderFormattedNote, extractLinks, FormattedLink } from '../utils/textFormatting';

interface RichNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  value,
  onChange,
  label = 'Isi Catatan Pengumuman Akademik:',
  placeholder = 'Ketik catatan pengumuman atau instruksi pendaftaran di sini...'
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Link dialog modal state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkDisplayText, setLinkDisplayText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState<{ start: number; end: number } | null>(null);

  // Active / Selected Link for Google Forms floating popover tooltip
  const [activeFloatingLink, setActiveFloatingLink] = useState<{
    text: string;
    url: string;
    startIndex: number;
    endIndex: number;
    raw: string;
  } | null>(null);

  // Mode: 'interactive' (Google Forms preview with clickable tooltip) or 'raw'
  const [editorTab, setEditorTab] = useState<'editor' | 'preview'>('editor');

  // Find all links currently in value
  const detectedLinks = extractLinks(value);

  // Auto detect if cursor in textarea is inside a link
  const handleTextareaSelect = () => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const found = detectedLinks.find(l => cursor >= l.startIndex && cursor <= l.endIndex);
    if (found) {
      setActiveFloatingLink(found);
    } else {
      setActiveFloatingLink(null);
    }
  };

  // Helper to apply formatting to selected text in textarea
  const applyWrapFormat = (prefix: string, suffix: string = prefix) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.substring(start, end);

    let nextValue: string;
    let nextStart = start;
    let nextEnd = end;

    if (start === end) {
      // No text selected, insert placeholder
      const placeholderText = 'teks';
      nextValue = value.substring(0, start) + prefix + placeholderText + suffix + value.substring(end);
      nextStart = start + prefix.length;
      nextEnd = nextStart + placeholderText.length;
    } else {
      // Text selected, wrap it
      nextValue = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
      nextStart = start;
      nextEnd = end + prefix.length + suffix.length;
    }

    onChange(nextValue);

    // Restore focus and selection
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    }, 0);
  };

  // Insert or edit link handler
  const handleOpenLinkModal = (existingLink?: FormattedLink) => {
    const el = textareaRef.current;
    if (existingLink) {
      setLinkDisplayText(existingLink.text);
      setLinkUrl(existingLink.url);
      setEditingLinkIndex({ start: existingLink.startIndex, end: existingLink.endIndex });
    } else if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.substring(start, end).trim();

      // Check if cursor was inside a link
      const existing = detectedLinks.find(l => start >= l.startIndex && end <= l.endIndex);
      if (existing) {
        setLinkDisplayText(existing.text);
        setLinkUrl(existing.url);
        setEditingLinkIndex({ start: existing.startIndex, end: existing.endIndex });
      } else {
        setLinkDisplayText(selected || 'Klik Disini');
        setLinkUrl('https://docs.google.com/spreadsheets/');
        setEditingLinkIndex(start !== end ? { start, end } : null);
      }
    } else {
      setLinkDisplayText('Klik Disini');
      setLinkUrl('https://docs.google.com/spreadsheets/');
      setEditingLinkIndex(null);
    }

    setIsLinkModalOpen(true);
  };

  const handleApplyLink = () => {
    let cleanUrl = linkUrl.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const cleanText = linkDisplayText.trim() || cleanUrl;
    const markdownLink = `[${cleanText}](${cleanUrl})`;

    const el = textareaRef.current;

    if (editingLinkIndex) {
      // Replace existing link or selected range
      const nextValue = 
        value.substring(0, editingLinkIndex.start) + 
        markdownLink + 
        value.substring(editingLinkIndex.end);
      onChange(nextValue);
    } else if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextValue = value.substring(0, start) + markdownLink + value.substring(end);
      onChange(nextValue);
    } else {
      onChange(value + (value.length > 0 ? ' ' : '') + markdownLink);
    }

    setIsLinkModalOpen(false);
    setLinkDisplayText('');
    setLinkUrl('');
    setEditingLinkIndex(null);
    setActiveFloatingLink(null);

    if (el) {
      setTimeout(() => el.focus(), 0);
    }
  };

  // Remove hyperlink (Unlink icon in Google Forms style)
  const handleRemoveLink = (linkToRemove: FormattedLink) => {
    const nextValue = 
      value.substring(0, linkToRemove.startIndex) + 
      linkToRemove.text + 
      value.substring(linkToRemove.endIndex);
    
    onChange(nextValue);
    setActiveFloatingLink(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // List actions
  const handleApplyList = (type: 'number' | 'bullet') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;

    // Find full lines surrounding selection
    const before = value.substring(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const after = value.substring(end);
    const lineEndOffset = after.indexOf('\n');
    const lineEnd = lineEndOffset === -1 ? value.length : end + lineEndOffset;

    const selectedBlock = value.substring(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');

    let counter = 1;
    const formattedLines = lines.map((line) => {
      // Remove any existing bullet or number
      const cleaned = line.replace(/^(\d+[\.\)]|[•\-\*])\s*/, '');
      if (type === 'number') {
        return `${counter++}. ${cleaned}`;
      } else {
        return `• ${cleaned}`;
      }
    });

    const nextValue = value.substring(0, lineStart) + formattedLines.join('\n') + value.substring(lineEnd);
    onChange(nextValue);

    setTimeout(() => {
      el.focus();
    }, 0);
  };

  // Clear formatting from selection
  const handleClearFormatting = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (start === end) {
      // Clear all markup from whole text
      const cleaned = value
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/<u>(.*?)<\/u>/g, '$1')
        .replace(/<[b|i]>(.*?)<\/[b|i]>/g, '$1');
      onChange(cleaned);
      return;
    }

    const selected = value.substring(start, end);
    const cleaned = selected
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/<u>(.*?)<\/u>/g, '$1')
      .replace(/<[b|i]>(.*?)<\/[b|i]>/g, '$1');

    const nextValue = value.substring(0, start) + cleaned + value.substring(end);
    onChange(nextValue);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
          {label}
        </label>
        
        {/* Tab Switcher: Editor vs Google Forms Preview */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setEditorTab('editor')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              editorTab === 'editor'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ✏️ Editor &amp; Tautan
          </button>
          <button
            type="button"
            onClick={() => setEditorTab('preview')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              editorTab === 'preview'
                ? 'bg-white dark:bg-slate-900 text-[#008744] dark:text-emerald-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>👁️ Pratinjau Mahasiswa</span>
            {detectedLinks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px]">
                {detectedLinks.length} Link
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Container: Google Forms Styled Box */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs overflow-hidden focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 transition-all">
        
        {/* FLOATING POPOVER TOOLTIP (GOOGLE FORMS STYLE AS SHOWN IN USER SCREENSHOT) */}
        {activeFloatingLink && (
          <div className="bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 px-3.5 py-2 border-b border-slate-700 flex items-center justify-between gap-3 text-xs animate-fade-in shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Tautan:
              </span>
              <a
                href={activeFloatingLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-400 hover:text-blue-300 underline truncate max-w-xs sm:max-w-md block"
                title={activeFloatingLink.url}
              >
                {activeFloatingLink.url}
              </a>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenLinkModal(activeFloatingLink)}
                className="p-1.5 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-200 hover:text-white transition-colors cursor-pointer"
                title="Edit Tautan (Ubah URL / Teks)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveLink(activeFloatingLink)}
                className="p-1.5 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                title="Hapus Tautan (Jadikan Teks Biasa)"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveFloatingLink(null)}
                className="p-1.5 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Tutup Panel Tautan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* EDITOR AREA */}
        {editorTab === 'editor' ? (
          <div className="p-3 sm:p-4">
            <textarea
              ref={textareaRef}
              rows={6}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                handleTextareaSelect();
              }}
              onSelect={handleTextareaSelect}
              onClick={handleTextareaSelect}
              onKeyUp={handleTextareaSelect}
              placeholder={placeholder}
              className="w-full text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent border-0 focus:outline-none focus:ring-0 resize-y leading-relaxed font-sans"
            />
          </div>
        ) : (
          /* PRATINJAU INTERAKTIF MAHASISWA DENGAN POPOVER KLIK */
          <div className="p-4 sm:p-5 min-h-[160px] bg-slate-50/50 dark:bg-slate-800/40">
            <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              {renderFormattedNote(value, {
                onLinkClick: (url, text, e) => {
                  e.preventDefault();
                  const found = detectedLinks.find(l => l.url === url && l.text === text) || {
                    text,
                    url,
                    startIndex: value.indexOf(url),
                    endIndex: value.indexOf(url) + url.length,
                    raw: `[${text}](${url})`
                  };
                  setActiveFloatingLink(found);
                }
              })}
            </div>
            
            <p className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-400 italic">
              💡 Klik tautan mana pun di atas untuk memunculkan tooltip popover URL, tombol edit tautan ✏️, atau hapus tautan 🔗.
            </p>
          </div>
        )}

        {/* GOOGLE FORMS MINIMALIST TOOLBAR (PERSIS SEPERTI GAMBAR LAMPIRAN) */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 select-none">
          
          {/* Main Action Icons: B, I, U, Link, 1.2.3, Bullet, Clear */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyWrapFormat('**')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer"
              title="Tebalkan Teks (Bold / B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyWrapFormat('*')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 italic transition-colors cursor-pointer"
              title="Miringkan Teks (Italic / I)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyWrapFormat('<u>', '</u>')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 underline transition-colors cursor-pointer"
              title="Garis Bawah (Underline / U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Tombol Buat Link (Icon Link seperti di Google Forms) */}
            <button
              type="button"
              onClick={() => handleOpenLinkModal()}
              className="px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              title="Sisipkan / Buat Tautan Link (Seperti di Google Form)"
            >
              <LinkIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Link</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={() => handleApplyList('number')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Daftar Bernomor (Numbered List)"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleApplyList('bullet')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Daftar Poin (Bulleted List)"
            >
              <List className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={handleClearFormatting}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Hapus Pemformatan (Clear Formatting / Tx)"
            >
              <RemoveFormatting className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Preset: Link Jadwal Kuliah Google Sheets */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const sampleLink = '\nLink Jadwal Kuliah: [Klik Disini](https://docs.google.com/spreadsheets/d/1_instiper_jadwal_kuliah/edit)';
                onChange(value + sampleLink);
              }}
              className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
              title="Tambahkan contoh 'Link Jadwal Kuliah: Klik Disini' seperti pada lampiran"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>+ Contoh Jadwal Kuliah</span>
            </button>
          </div>

        </div>

      </div>

      {/* Detected Links Chips in Current Note */}
      {detectedLinks.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Globe className="w-3 h-3 text-blue-500" />
            Tautan Aktif ({detectedLinks.length}):
          </span>
          {detectedLinks.map((link, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs group"
            >
              <span className="font-semibold text-blue-600 dark:text-blue-400 underline">
                {link.text}
              </span>
              <span className="text-[10px] text-slate-400 max-w-[140px] truncate">
                ({link.url})
              </span>
              <button
                type="button"
                onClick={() => handleOpenLinkModal(link)}
                className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                title="Edit link"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveLink(link)}
                className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                title="Hapus link (ubah jadi teks biasa)"
              >
                <Unlink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GOOGLE FORMS LINK INSERTION / EDIT MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {editingLinkIndex ? 'Edit Tautan' : 'Tambahkan Tautan Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Format link ala Google Forms untuk catatan pengumuman
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyLink();
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Teks untuk ditampilkan (Label Link):
                </label>
                <input
                  type="text"
                  required
                  value={linkDisplayText}
                  onChange={(e) => setLinkDisplayText(e.target.value)}
                  placeholder="Contoh: Klik Disini, Jadwal Kuliah, Unduh PDF..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tautan URL Web / Dokumen:
                </label>
                <input
                  type="text"
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-medium text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Bisa berupa link Google Drive, Google Sheets, link website kampus, atau grup WhatsApp.
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Preset Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkDisplayText('Klik Disini');
                      setLinkUrl('https://docs.google.com/spreadsheets/');
                    }}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    📊 Google Sheets
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkDisplayText('Lihat Jadwal PDF');
                      setLinkUrl('https://drive.google.com/');
                    }}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    📁 Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkDisplayText('Website Fakultas');
                      setLinkUrl('https://faperta.instiperjogja.ac.id');
                    }}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    🏛️ Web INSTIPER
                  </button>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan Tautan</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
