import MainApp from './App';
import { TimelineProvider } from './TimelineContext';
import RenderApp from 'src/index';

const App = () => {
    return (
        <TimelineProvider>
            <MainApp />
        </TimelineProvider>
    )
}

RenderApp({ App });
