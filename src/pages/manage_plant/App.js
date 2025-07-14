import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import NoteModal from './NoteModal';
import GroupModal from './GroupModal';
import PhotoModal from './PhotoModal';
import RepotModal from './RepotModal';
import DivisionModal from './DivisionModal';
import EditPlantModal from './EditPlantModal';

const App = () => {
    return (
        <ReduxProvider>
            <Layout />
            <Settings />
            <NoteModal />
            <GroupModal />
            <PhotoModal />
            <RepotModal />
            <DivisionModal />
            <EditPlantModal />
        </ReduxProvider>
    );
};

export default App;
