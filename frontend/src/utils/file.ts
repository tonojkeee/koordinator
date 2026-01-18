/**
 * File-related utility functions.
 * 
 * Provides consistent file size formatting and file operations
 * across the application.
 */

/**
 * Format file size in bytes to human-readable string.
 * 
 * @param bytes - File size in bytes (can be null/undefined)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 * 
 * @example
 * formatFileSize(1536) // "1.50 KB"
 * formatFileSize(1048576) // "1.00 MB"
 * formatFileSize(undefined) // "0 B"
 * formatFileSize(1536, 0) // "2 KB"
 */
export const formatFileSize = (
  bytes: number | undefined | null,
  decimals: number = 2
): string => {
  if (!bytes || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
};

/**
 * Get file extension from filename.
 * 
 * @param filename - Filename or path
 * @returns File extension (lowercase, with dot) or empty string
 * 
 * @example
 * getFileExtension('document.pdf') // ".pdf"
 * getFileExtension('archive.tar.gz') // ".gz"
 * getFileExtension('README') // ""
 */
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return filename.slice(lastDot).toLowerCase();
};

/**
 * Get filename without extension.
 * 
 * @param filename - Filename or path
 * @returns Filename without extension
 * 
 * @example
 * getFileNameWithoutExtension('document.pdf') // "document"
 * getFileNameWithoutExtension('archive.tar.gz') // "archive.tar"
 */
export const getFileNameWithoutExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.slice(0, lastDot);
};

/**
 * Check if file type is an image.
 * 
 * @param filename - Filename or MIME type
 * @returns True if file is an image
 * 
 * @example
 * isImageFile('photo.jpg') // true
 * isImageFile('document.pdf') // false
 * isImageFile('image/png') // true
 */
export const isImageFile = (filename: string): boolean => {
  if (filename.startsWith('image/')) return true;

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
};

/**
 * Check if file type is a document.
 * 
 * @param filename - Filename or MIME type
 * @returns True if file is a document
 * 
 * @example
 * isDocumentFile('report.pdf') // true
 * isDocumentFile('data.xlsx') // true
 * isDocumentFile('photo.jpg') // false
 */
export const isDocumentFile = (filename: string): boolean => {
  const documentExtensions = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.rtf',
    '.odt',
    '.ods',
    '.odp',
  ];
  const ext = getFileExtension(filename);
  return documentExtensions.includes(ext);
};

/**
 * Get icon name for file type (for use with icon libraries).
 * 
 * @param filename - Filename or path
 * @returns Icon name suggestion
 * 
 * @example
 * getFileIcon('document.pdf') // "file-text"
 * getFileIcon('photo.jpg') // "image"
 * getFileIcon('archive.zip') // "archive"
 */
export const getFileIcon = (filename: string): string => {
  const ext = getFileExtension(filename);

  // Images
  if (isImageFile(filename)) return 'image';

  // Documents
  if (['.pdf'].includes(ext)) return 'file-text';
  if (['.doc', '.docx'].includes(ext)) return 'file-text';
  if (['.xls', '.xlsx'].includes(ext)) return 'file-spreadsheet';
  if (['.ppt', '.pptx'].includes(ext)) return 'file-presentation';

  // Archives
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'archive';

  // Code
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp'].includes(ext)) return 'code';

  // Default
  return 'file';
};
