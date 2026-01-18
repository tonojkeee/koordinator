import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useDocumentViewer } from '../store/useDocumentViewer';
import { useTranslation } from 'react-i18next';
import * as mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import DOMPurify from 'dompurify';

const DocumentViewer: React.FC = () => {
    const { t } = useTranslation();
    const { isOpen, url, title, filename, mimeType, close } = useDocumentViewer();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [excelData, setExcelData] = useState<unknown[][]>([]);
    const [textContent, setTextContent] = useState<string>('');

    const getExtension = (path: string | null) => {
        if (!path) return '';
        // Remove query parameters
        const cleanPath = path.split('?')[0];
        return cleanPath.split('.').pop()?.toLowerCase() || '';
    };

    const fileExtension = filename ? getExtension(filename) : getExtension(url);
    const isImage = mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
    const isPDF = mimeType === 'application/pdf' || fileExtension === 'pdf';
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === 'docx';
    const isExcel = mimeType?.includes('sheet') || mimeType?.includes('excel') || ['xlsx', 'xls', 'csv'].includes(fileExtension || '');
    const isText = mimeType?.startsWith('text/') || fileExtension === 'txt';
    const isOffice = isDocx || isExcel;
    const isLoadable = isOffice || isText;

    useEffect(() => {
        if (!isOpen || !url || !isLoadable) {
            setHtmlContent('');
            setExcelData([]);
            setTextContent('');
            setError(null);
            return;
        }

        const fetchAndRender = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Не удалось загрузить файл');
                if (isDocx) {
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    setHtmlContent(result.value);
                } else if (isExcel) {
                    const arrayBuffer = await response.arrayBuffer();
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(arrayBuffer);
                    const worksheet = workbook.worksheets[0];
                    const data: unknown[][] = [];
                    worksheet.eachRow((row) => {
                        const rowData: unknown[] = [];
                        row.eachCell({ includeEmpty: true }, (cell) => {
                            rowData.push(cell.value);
                        });
                        data.push(rowData);
                    });
                    setExcelData(data);
                } else if (isText) {
                    const text = await response.text();
                    setTextContent(text);
                }
            } catch (err: unknown) {
                console.error('Error rendering document:', err);
                const error = err as Error;
                setError(error.message || 'Ошибка при чтении документа');
            } finally {
                setLoading(false);
            }
        };

        fetchAndRender();
    }, [isOpen, url, isOffice, isDocx, isExcel, isLoadable, isText]);

    if (!isOpen || !url) return null;

    const handleDownload = () => {
        const link = document.createElement('a');
        // If it's a board document URL, ensure we use the download endpoint
        const downloadUrl = url.replace('/board/documents/', '/board/documents/').replace('/view', '/download');
        link.href = downloadUrl;
        link.download = title || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="absolute top-6 right-6 flex items-center space-x-4 z-10">
                <button
                    onClick={handleDownload}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all flex items-center space-x-2"
                    title="Скачать"
                >
                    <Download size={20} />
                    <span className="text-sm font-bold pr-2">Скачать</span>
                </button>
                <button
                    onClick={close}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="absolute top-6 left-6 z-10">
                <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-xl border border-white/10">
                    <h3 className="text-white font-bold tracking-tight">{title}</h3>
                </div>
            </div>

            <div className="w-full h-full p-12 lg:p-24 flex items-center justify-center">
                <div className="w-full h-full bg-slate-800 rounded-3xl shadow-2xl overflow-hidden relative border border-white/10 flex flex-col">
                    <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                        {loading ? (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                <p className="text-slate-500 font-bold">{t('board.viewer.preparing')}</p>
                            </div>
                        ) : error ? (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 text-center">
                                <AlertCircle className="w-16 h-16 text-rose-500" />
                                <h4 className="text-xl font-bold text-slate-900">{error}</h4>
                                <button
                                    onClick={handleDownload}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                                >
                                    {t('board.viewer.download_and_open')}
                                </button>
                            </div>
                        ) : isImage ? (
                            <div className="w-full h-full flex items-center justify-center p-8 bg-slate-100">
                                <img
                                    src={url}
                                    alt={title || ''}
                                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in duration-500"
                                />
                            </div>
                        ) : isPDF ? (
                            <iframe
                                src={`${url}#toolbar=0`}
                                className="w-full h-full border-none"
                                title={title || ''}
                            />
                        ) : isDocx ? (
                            <div
                                className="p-12 md:p-20 max-w-4xl mx-auto prose prose-slate prose-indigo selection:bg-indigo-100"
                                 dangerouslySetInnerHTML={{ 
                                     __html: DOMPurify.sanitize(htmlContent, {
                                         ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li'],
                                         ALLOWED_ATTR: ['class']
                                     })
                                 }}
                            />
                        ) : isExcel ? (
                            <div className="p-4 md:p-8">
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                {excelData[0]?.map((cell, i) => (
                                                    <th key={i} className="p-3 font-bold text-slate-700 border-r border-slate-200 last:border-0 uppercase tracking-wider text-[10px]">
                                                        {String(cell)}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelData.slice(1).map((row, i) => (
                                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="p-3 text-slate-600 border-r border-slate-100 last:border-0 whitespace-nowrap">
                                                            {String(cell)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : isText ? (
                            <div className="p-8 md:p-12 bg-white min-h-full">
                                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 bg-slate-50 p-6 rounded-xl border border-slate-100">
                                    {textContent}
                                </pre>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-6 bg-slate-50">
                                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-inner">
                                    <FileText size={48} className="text-slate-300" />
                                </div>
                                <div className="text-center max-w-md">
                                    <h4 className="text-xl font-bold mb-2 text-slate-900">{t('board.viewer.format_not_supported')}</h4>
                                    <p className="text-slate-500 text-sm">{t('board.viewer.preview_unavailable')}</p>
                                </div>
                                <div className="flex space-x-4">
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-8 h-12 bg-white text-slate-900 border border-slate-200 rounded-2xl flex items-center space-x-2 font-bold hover:bg-slate-50 transition-all shadow-sm"
                                    >
                                        <ExternalLink size={18} />
                                        <span>{t('board.viewer.open_in_browser')}</span>
                                    </a>
                                    <button
                                        onClick={handleDownload}
                                        className="px-8 h-12 bg-indigo-600 text-white rounded-2xl flex items-center space-x-2 font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                    >
                                        <Download size={18} />
                                        <span>{t('board.viewer.download_file')}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentViewer;
