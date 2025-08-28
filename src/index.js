import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';
import router from './routes';
import 'src/css/index.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<AppRoot router={router} />);
