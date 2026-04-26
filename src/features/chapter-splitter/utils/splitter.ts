import { formatText } from '@/features/text-formatter/utils/formatter';
import { CHINESE_CHAR_REGEX } from '@/shared/utils/regex';

export interface PartData {
  title: string;
  content: string;
  text: string;
  wordCount: number;
}

export interface SplitResult {
  parts: PartData[];
  totalWords: number;
  /** If multi-chapter mode was used, this contains info about each chapter */
  chapterCount?: number;
}

/**
 * Regex to detect chapter heading lines:
 * - Chương 1: xxx
 * - Chương 1234: xxx  
 * - CHƯƠNG 1: xxx
 * - chương 100 xxx
 * Also supports chapter names without colon
 */
const CHAPTER_HEADING_REGEX = /^chương\s+\d+/i;

export function getWordCount(text: string): number {
  if (!text.trim()) return 0;
  if (CHINESE_CHAR_REGEX.test(text)) {
    return text.replace(/\s/g, '').length;
  }
  return text.trim().split(/\s+/).length;
}

/**
 * Removes duplicate chapter title lines that appear immediately after a chapter heading.
 * This ensures clean content for both chapter splitters and TTC uploader.
 */
export function removeDuplicateChapterTitles(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const match = line.trim().match(CHAPTER_HEADING_REGEX);

    if (match) {
      result.push(line);
      // Actually, CHAPTER_HEADING_REGEX doesn't capture the number. Let's use a local regex.
      const localMatch = line.trim().match(/^(chương\s+(\d+))/i);
      const num = localMatch ? localMatch[2] : null;
      i++;

      const blanks: string[] = [];
      while (i < lines.length && lines[i].trim() === '') {
        blanks.push(lines[i]);
        i++;
      }

      if (num && i < lines.length) {
        const nextMatch = lines[i].trim().match(/^(chương\s+(\d+))/i);
        if (nextMatch && nextMatch[2] === num) {
          // Drop duplicate
          i++;
        } else {
          result.push(...blanks);
        }
      } else {
        result.push(...blanks);
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Count how many chapter boundaries exist in the given raw text.
 */
export function countChapterBoundaries(text: string): number {
  const lines = text.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (CHAPTER_HEADING_REGEX.test(line.trim())) {
      count++;
    }
  }
  return count;
}

/**
 * Detect if the input contains multiple chapters (2+).
 */
export function detectMultiChapterMode(text: string): boolean {
  return countChapterBoundaries(text) >= 2;
}

export function splitChapter(text: string, maxWords: number, roundUp: boolean = true, minWords: number = 0): SplitResult {
  const cleanedText = removeDuplicateChapterTitles(text);
  const formatted = formatText(cleanedText).text;
  if (!formatted) return { parts: [], totalWords: 0 };

  const paragraphs = formatted.split('\n\n');
  if (paragraphs.length === 0) return { parts: [], totalWords: 0 };

  // Assume the first line is the chapter name
  const chapterName = paragraphs[0];
  const content = paragraphs.slice(1);
  
  // If the text is extremely short and only has 1 paragraph
  if (content.length === 0) {
    const textPart = chapterName;
    return { 
      parts: [{ title: chapterName, content: '', text: textPart, wordCount: getWordCount(chapterName) }], 
      totalWords: getWordCount(chapterName) 
    };
  }

  const parts: string[][] = [];
  let currentPart: string[] = [];
  let currentWordCount = 0;
  let totalWords = 0;

  for (let i = 0; i < content.length; i++) {
    const p = content[i];
    const wordsInP = getWordCount(p);
    totalWords += wordsInP;

    if (roundUp) {
      // Round up: add paragraph first, then split if over limit
      currentPart.push(p);
      currentWordCount += wordsInP;

      if (currentWordCount >= maxWords && i < content.length - 1) {
        parts.push(currentPart);
        currentPart = [];
        currentWordCount = 0;
      }
    } else {
      // Round down: split before adding if it would exceed limit
      if (currentWordCount + wordsInP > maxWords && currentPart.length > 0) {
        parts.push(currentPart);
        currentPart = [];
        currentWordCount = 0;
      }
      currentPart.push(p);
      currentWordCount += wordsInP;
    }
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  // Merge last part into previous if it's too short
  if (minWords > 0 && parts.length >= 2) {
    const lastPartWords = parts[parts.length - 1].reduce((sum, p) => sum + getWordCount(p), 0);
    if (lastPartWords < minWords) {
      const lastPart = parts.pop()!;
      parts[parts.length - 1].push(...lastPart);
    }
  }

  const resultParts: PartData[] = parts.map((part, index) => {
    const heading = parts.length > 1 ? `${chapterName} (${index + 1}/${parts.length})` : chapterName;
    const contentText = part.join('\n\n');
    const text = [heading, contentText].join('\n\n');
    return {
      title: heading,
      content: contentText,
      text,
      wordCount: getWordCount(text)
    };
  });

  // Let's ensure the word count includes heading for each part so it's accurate to what's generated
  resultParts.forEach(p => {
    p.wordCount = getWordCount(p.text);
  });

  return {
    parts: resultParts,
    totalWords
  };
}

/**
 * Split raw text containing multiple chapters into individual chapter blocks,
 * then split each chapter by maxWords, and combine all output into a single result.
 */
export function splitMultipleChapters(
  rawText: string,
  maxWords: number,
  roundUp: boolean = true,
  minWords: number = 0
): SplitResult {
  const cleanedText = removeDuplicateChapterTitles(rawText);
  const formatted = formatText(cleanedText).text;
  if (!formatted) return { parts: [], totalWords: 0, chapterCount: 0 };

  const paragraphs = formatted.split('\n\n');

  // Group paragraphs into chapters based on chapter headings
  const chapters: { heading: string; content: string[] }[] = [];
  let currentChapter: { heading: string; content: string[] } | null = null;

  for (const para of paragraphs) {
    if (CHAPTER_HEADING_REGEX.test(para.trim())) {
      // Start a new chapter
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      currentChapter = { heading: para.trim(), content: [] };
    } else if (currentChapter) {
      currentChapter.content.push(para);
    }
    // If we haven't found any chapter heading yet, skip orphan paragraphs
  }
  if (currentChapter) {
    chapters.push(currentChapter);
  }

  if (chapters.length === 0) {
    return { parts: [], totalWords: 0, chapterCount: 0 };
  }

  // Process each chapter
  const allParts: PartData[] = [];
  let totalWords = 0;

  for (const chapter of chapters) {
    if (chapter.content.length === 0) {
      // Chapter with only a heading, no content
      const text = chapter.heading;
      const wc = getWordCount(text);
      totalWords += wc;
      allParts.push({ title: chapter.heading, content: '', text, wordCount: wc });
      continue;
    }

    // Calculate total word count for this chapter's content
    const chapterContentWords = chapter.content.reduce((sum, p) => sum + getWordCount(p), 0);
    totalWords += chapterContentWords;

    // Check if this chapter needs splitting
    if (chapterContentWords <= maxWords) {
      // No splitting needed — output as-is
      const contentText = chapter.content.join('\n\n');
      const text = [chapter.heading, contentText].join('\n\n');
      allParts.push({ title: chapter.heading, content: contentText, text, wordCount: getWordCount(text) });
    } else {
      // Split this chapter into parts
      const parts: string[][] = [];
      let currentPart: string[] = [];
      let currentWordCount = 0;

      for (let i = 0; i < chapter.content.length; i++) {
        const p = chapter.content[i];
        const wordsInP = getWordCount(p);

        if (roundUp) {
          currentPart.push(p);
          currentWordCount += wordsInP;
          if (currentWordCount >= maxWords && i < chapter.content.length - 1) {
            parts.push(currentPart);
            currentPart = [];
            currentWordCount = 0;
          }
        } else {
          if (currentWordCount + wordsInP > maxWords && currentPart.length > 0) {
            parts.push(currentPart);
            currentPart = [];
            currentWordCount = 0;
          }
          currentPart.push(p);
          currentWordCount += wordsInP;
        }
      }
      if (currentPart.length > 0) {
        parts.push(currentPart);
      }

      // Merge last part into previous if it's too short
      if (minWords > 0 && parts.length >= 2) {
        const lastPartWords = parts[parts.length - 1].reduce((sum, p) => sum + getWordCount(p), 0);
        if (lastPartWords < minWords) {
          const lastPart = parts.pop()!;
          parts[parts.length - 1].push(...lastPart);
        }
      }

      // Build output parts with heading (X/Y)
      for (let i = 0; i < parts.length; i++) {
        const heading = parts.length > 1 ? `${chapter.heading} (${i + 1}/${parts.length})` : chapter.heading;
        const contentText = parts[i].join('\n\n');
        const text = [heading, contentText].join('\n\n');
        allParts.push({ title: heading, content: contentText, text, wordCount: getWordCount(text) });
      }
    }
  }

  return {
    parts: allParts,
    totalWords,
    chapterCount: chapters.length,
  };
}
