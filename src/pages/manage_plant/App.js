import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import NoteModal from './NoteModal';
import GroupModal from './GroupModal';
import PhotoModal from './PhotoModal';
import RepotModal from './RepotModal';
import EditPlantModal from './EditPlantModal';
import DefaultPhotoModal from './DefaultPhotoModal';
import DeletePhotosModal from './DeletePhotosModal';
import EventHistoryModal from './EventHistoryModal';

const App = () => {
    return (
        <ReduxProvider>
            <Layout />
            <Settings />
            <NoteModal />
            <GroupModal />
            <PhotoModal />
            <RepotModal />
            <EditPlantModal />
            <DefaultPhotoModal />
            <DeletePhotosModal />
            <EventHistoryModal />
        </ReduxProvider>
    );
};

export default App;
