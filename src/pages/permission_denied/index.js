import App from './App';
import { createRoot } from 'react-dom/client';
import { parseDomContext } from 'src/util';
import UnsupportedBrowserWarning from 'src/components/UnsupportedBrowserWarning';

const container = document.getElementById('root');
const root = createRoot(container);
const initialError = parseDomContext('error');
root.render(
    <>
        <App errorMessage={initialError} />
        <UnsupportedBrowserWarning />
    </>
);
