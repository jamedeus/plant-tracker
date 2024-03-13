import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'src/main.css';
import { ThemeProvider } from 'src/context/ThemeContext';


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <ThemeProvider>
        <App />
    </ThemeProvider>
);
