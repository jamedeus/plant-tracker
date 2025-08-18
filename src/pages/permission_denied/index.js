import App from './App';
import { createRoot } from 'react-dom/client';
import { parseDomContext } from 'src/util';
import { PageWrapper } from 'src/index';

const container = document.getElementById('root');
const root = createRoot(container);
const initialError = parseDomContext('error');
root.render(
    <PageWrapper>
        <App errorMessage={initialError} />
    </PageWrapper>
);
