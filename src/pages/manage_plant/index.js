import MainApp from './App';
import { ReduxProvider } from './store';
import RenderApp from 'src/index';

const App = () => {
    return (
        <ReduxProvider>
            <MainApp />
        </ReduxProvider>
    )
}

RenderApp({ App });
