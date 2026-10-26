import React from 'react';
import { ExternalLink } from 'lucide-react';

export interface FormattedLink {
  text: string;
  url: string;
  startIndex: number;
  endIndex: number;
  raw: string; // e.g. "[Klik Disini](https://...)"
}

/**
 * Extract all markdown links [text](url) and raw http/https links from text
 */
export function extractLinks(text: string): FormattedLink[] {
  const links: FormattedLink[] = [];
  
  // 1. Match markdown links: [Text](URL)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  
  while ((match = mdRegex.exec(text)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      raw: match[0]
    });
  }

  // 2. Match standalone URLs not already inside a markdown link
  const rawUrlRegex = /(https?:\/\/[^\s<>[\]()]+)/g;
  while ((match = rawUrlRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Check if overlaps with any markdown link
    const overlaps = links.some(l => start >= l.startIndex && end <= l.endIndex);
    if (!overlaps) {
      links.push({
        text: match[0],
        url: match[0],
        startIndex: start,
        endIndex: end,
        raw: match[0]
      });
    }
  }

  return links.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Safely parse markdown-style formatting:
 * - [Link Label](https://...) -> clickable <a> with icon
 * - raw https://... -> clickable <a>
 * - **bold** or <b>bold</b>
 * - *italic* or <i>italic</i>
 * - <u>underline</u>
 * - preserved line breaks & bullet lists
 */
export function renderFormattedNote(
  content: string,
  options?: {
    linkClassName?: string;
    showExternalIcon?: boolean;
    onLinkClick?: (url: string, text: string, e: React.MouseEvent) => void;
  }
): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed break-words">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        const isNumbered = /^\s*(\d+[\.\)])\s+(.*)/.exec(line);
        const isBullet = /^\s*([•\-\*])\s+(.*)/.exec(line);

        if (isNumbered) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                {isNumbered[1]}
              </span>
              <div className="flex-1 min-w-0">
                {parseInlineFormatting(isNumbered[2], options)}
              </div>
            </div>
          );
        }

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                •
              </span>
              <div className="flex-1 min-w-0">
                {parseInlineFormatting(isBullet[2], options)}
              </div>
            </div>
          );
        }

        return (
          <p key={lineIdx}>
            {parseInlineFormatting(line, options)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses inline links, bold, italics, and underlines
 */
export function parseInlineFormatting(
  text: string,
  options?: {
    linkClassName?: string;
    showExternalIcon?: boolean;
    onLinkClick?: (url: string, text: string, e: React.MouseEvent) => void;
  }
): React.ReactNode[] {
  // Regex pattern matching:
  // 1. Markdown link: \[([^\]]+)\]\((https?:\/\/[^\s)]+)\)
  // 2. Raw URL: (https?:\/\/[^\s<>[\]()]+)
  // 3. HTML <u>: <u>(.*?)<\/u>
  // 4. Bold: \*\*([^*]+)\*\* or <b>(.*?)<\/b>
  // 5. Italic: \*([^*]+)\* or <i>(.*?)<\/i>

  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>[\]()]+)|(<u>(.*?)<\/u>)|(\*\*([^*]+)\*\*)|(<b>(.*?)<\/b>)|(\*([^*]+)\*)|(<i>(.*?)<\/i>)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  let keyCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Add text preceding match
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const [
      fullMatch,
      isMdLink,
      mdText,
      mdUrl,
      rawUrl,
      isU,
      uText,
      isDoubleStarBold,
      doubleStarBoldText,
      isHtmlBold,
      htmlBoldText,
      isStarItalic,
      starItalicText,
      isHtmlItalic,
      htmlItalicText
    ] = match;

    if (isMdLink) {
      elements.push(
        <a
          key={`link-${keyCounter++}`}
          href={mdUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => options?.onLinkClick?.(mdUrl, mdText, e)}
          className={
            options?.linkClassName ||
            'inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 underline decoration-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:decoration-blue-600 transition-colors'
          }
          title={`Buka tautan: ${mdUrl}`}
        >
          <span>{mdText}</span>
          {(options?.showExternalIcon ?? true) && (
            <ExternalLink className="w-3 h-3 inline-block shrink-0 stroke-[2.5]" />
          )}
        </a>
      );
    } else if (rawUrl) {
      elements.push(
        <a
          key={`rawurl-${keyCounter++}`}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => options?.onLinkClick?.(rawUrl, rawUrl, e)}
          className={
            options?.linkClassName ||
            'inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 underline decoration-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:decoration-blue-600 transition-colors break-all'
          }
          title={`Buka tautan: ${rawUrl}`}
        >
          <span>{rawUrl}</span>
          {(options?.showExternalIcon ?? true) && (
            <ExternalLink className="w-3 h-3 inline-block shrink-0 stroke-[2.5]" />
          )}
        </a>
      );
    } else if (isU) {
      elements.push(
        <u key={`u-${keyCounter++}`} className="underline decoration-slate-400">
          {uText}
        </u>
      );
    } else if (isDoubleStarBold || isHtmlBold) {
      elements.push(
        <strong key={`b-${keyCounter++}`} className="font-bold text-slate-900 dark:text-white">
          {doubleStarBoldText || htmlBoldText}
        </strong>
      );
    } else if (isStarItalic || isHtmlItalic) {
      elements.push(
        <em key={`i-${keyCounter++}`} className="italic">
          {starItalicText || htmlItalicText}
        </em>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}
