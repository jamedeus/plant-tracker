import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import NoteModal from './NoteModal';
import 'src/css/index.css';
import initialStatePropTypes from './initialStatePropTypes';

const App = ({ initialState = null }) => {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <Settings />
            <NoteModal />
        </ReduxProvider>
    );
};

App.propTypes = {
    initialState: initialStatePropTypes.isRequired
};

export default App;
