import React from 'react';
import { createRoot } from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import App from './App';
import './styles.css';
import './diagram.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

createRoot(document.getElementById('root')).render(<App />);
