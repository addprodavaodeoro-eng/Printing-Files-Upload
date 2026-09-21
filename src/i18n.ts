import { useState, useEffect } from 'react';

export type Language = 'en' | 'fil';

export const translations = {
  en: {
    brandName: 'Oyangoren Printing Services',
    brandTagline: 'File Upload & Print Reception System',
    sendFiles: 'Send Your Files',
    sendFilesSub: 'Select the files you want to send for printing.',
    remoteSendFiles: 'Send Files for Printing',
    forCustomer: 'For',
    selectFiles: 'Select Files',
    dragDropText: 'or drag and drop files here',
    dragDropActive: 'Drop files to add for printing',
    supportedFormatsNotice: 'Supported: PDF, Word (DOC, DOCX), PowerPoint (PPT, PPTX), Excel (XLS, XLSX), and Images (JPG, PNG)',
    maxFileSize: 'Max size per file',
    remove: 'Remove',
    uploadFiles: 'Upload Files',
    submitPrintRequest: 'Submit Print Request',
    uploading: 'Uploading files...',
    pleaseWait: 'Please wait while your files are being transferred securely.',
    uploadSuccessTitle: 'Files uploaded successfully!',
    uploadSuccessDesc: 'Your files have been sent to Oyangoren Printing Services.',
    referenceCodeLabel: 'Reference Code',
    referenceCodeHelp: 'Show or provide this code to our shop staff when picking up your prints.',
    filesUploaded: 'Files uploaded',
    uploadAnother: 'Upload More Files',
    trackStatus: 'Track Print Status',
    printingInstructions: 'Printing Instructions',
    instructionsPlaceholder: 'Example: 3 copies, A4, colored cover, black & white inside pages, back-to-back.',
    instructionsHelp: 'Feel free to specify paper size, copies, color or B&W, binding, or special requests.',
    statusNew: 'Received & In Queue',
    statusProcessing: 'Printing in Progress',
    statusCompleted: 'Ready for Pickup',
    statusUnknown: 'Status Unknown',
    linkExpiredTitle: 'Link Has Expired',
    linkExpiredDesc: 'This upload link has expired. Please contact Oyangoren Printing Services for a new link.',
    linkDisabledTitle: 'Link Inactive',
    linkDisabledDesc: 'This upload link is currently deactivated. Please contact Oyangoren Printing Services.',
    linkLimitTitle: 'Upload Limit Reached',
    linkLimitDesc: 'This link has already reached its maximum allowed number of uploads.',
    linkNotFoundTitle: 'Invalid Link',
    linkNotFoundDesc: 'This upload link was not found or is invalid. Please verify the URL.',
    adminPortal: 'Admin Portal',
    adminLogin: 'Admin Login',
    backToHome: 'Back to Upload',
    connectionError: 'Network error or connection interrupted. Please try again.',
    fileTooLarge: 'File exceeds maximum size limit of',
    unsupportedFileType: 'Unsupported file type. Please select a valid document or image.',
    noFilesSelected: 'Please select at least one file to upload.',
  },
  fil: {
    brandName: 'Oyangoren Printing Services',
    brandTagline: 'File Upload at Print Reception System',
    sendFiles: 'Ipadala ang Iyong mga File',
    sendFilesSub: 'Piliin ang mga file na nais mong ipa-print.',
    remoteSendFiles: 'Ipadala ang mga File para sa Pag-print',
    forCustomer: 'Para kay',
    selectFiles: 'Pumili ng mga File',
    dragDropText: 'o i-drag at i-drop ang mga file dito',
    dragDropActive: 'I-drop ang mga file para ma-print',
    supportedFormatsNotice: 'Tinatanggap: PDF, Word (DOC, DOCX), PowerPoint (PPT, PPTX), Excel (XLS, XLSX), at Larawan (JPG, PNG)',
    maxFileSize: 'Pinakamataas na laki bawat file',
    remove: 'Alisin',
    uploadFiles: 'I-upload ang mga File',
    submitPrintRequest: 'Ipadala ang Print Request',
    uploading: 'Kasalukuyang nag-a-upload...',
    pleaseWait: 'Mangyaring maghintay habang ligtas na inililipat ang iyong mga file.',
    uploadSuccessTitle: 'Matagumpay na na-upload ang mga file!',
    uploadSuccessDesc: 'Naipadala na ang iyong mga file sa Oyangoren Printing Services.',
    referenceCodeLabel: 'Reference Code',
    referenceCodeHelp: 'Ipakita o ibigay ang code na ito sa staff ng shop sa pagkuha ng iyong printouts.',
    filesUploaded: 'Mga na-upload na file',
    uploadAnother: 'Mag-upload Pa ng Ibang File',
    trackStatus: 'Suriin ang Status ng Print',
    printingInstructions: 'Mga Tagubilin sa Pag-print (Printing Instructions)',
    instructionsPlaceholder: 'Halimbawa: 3 copies, A4, colored cover, black & white sa loob, back-to-back.',
    instructionsHelp: 'Maaari mong ilagay ang sukat ng papel, dami ng kopya, kulay, binding, o iba pang detalye.',
    statusNew: 'Natanggap at Nakapila',
    statusProcessing: 'Kasalukuyang Pino-proseso',
    statusCompleted: 'Handa nang Kunin',
    statusUnknown: 'Hindi Matukoy ang Status',
    linkExpiredTitle: 'Nag-expire na ang Link',
    linkExpiredDesc: 'Ang upload link na ito ay nag-expire na. Mangyaring humingi ng bagong link sa Oyangoren Printing Services.',
    linkDisabledTitle: 'Hindi Aktibo ang Link',
    linkDisabledDesc: 'Ang upload link na ito ay kasalukuyang nakasara. Mangyaring makipag-ugnayan sa shop.',
    linkLimitTitle: 'Naabot na ang Limitasyon sa Upload',
    linkLimitDesc: 'Naabot na ng link na ito ang pinakamataas na pinapayagang bilang ng uploads.',
    linkNotFoundTitle: 'Hindi Wastong Link',
    linkNotFoundDesc: 'Hindi nahanap o mali ang upload link. Mangyaring suriin ang tamang URL.',
    adminPortal: 'Admin Portal',
    adminLogin: 'Mag-login bilang Admin',
    backToHome: 'Bumalik sa Upload',
    connectionError: 'Nagkaroon ng problema sa koneksyon. Pakisubukan muli.',
    fileTooLarge: 'Sobra ang laki ng file sa pinapayagang',
    unsupportedFileType: 'Hindi sinusuportahang uri ng file. Pumili ng wastong dokumento o larawan.',
    noFilesSelected: 'Mangyaring pumili ng kahit isang file na ia-upload.',
  },
};

export function useI18n() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('oyangoren_lang') as Language) || 'en';
  });

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'fil' : 'en';
    setLang(next);
    localStorage.setItem('oyangoren_lang', next);
  };

  const t = translations[lang];

  return { lang, toggleLanguage, t };
}
