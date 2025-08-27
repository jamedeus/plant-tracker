import { createRoot } from 'react-dom/client';
import router from 'src/routes';
import AppRoot from './AppRoot';
import 'src/css/index.css';

/* istanbul ignore next */
function bootstrapSpa() {
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(<AppRoot router={router} />);
}

bootstrapSpa();
