import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import NoteModal from './NoteModal';
import GroupModal from './GroupModal';
import PhotoModal from './PhotoModal';
import DivisionModal from './DivisionModal';
import 'src/css/index.css';
import initialStatePropTypes from './initialStatePropTypes';

const App = ({ initialState = null }) => {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <Settings />
            <NoteModal />
            <GroupModal />
            <PhotoModal />
            <DivisionModal />
        </ReduxProvider>
    );
};

App.propTypes = {
    initialState: initialStatePropTypes.isRequired
};

export default App;
