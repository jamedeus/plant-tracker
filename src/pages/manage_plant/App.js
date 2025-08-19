import PropTypes from 'prop-types';
import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import NoteModal from './NoteModal';
import GroupModal from './GroupModal';
import PhotoModal from './PhotoModal';
import RepotModal from './RepotModal';
import DivisionModal from './DivisionModal';
import EditPlantModal from './EditPlantModal';
import 'src/css/index.css';

const App = ({ initialState = null }) => {
    return (
        <ReduxProvider initialState={initialState}>
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

App.propTypes = {
    initialState: PropTypes.shape({
        plant_details: PropTypes.object.isRequired,
        events: PropTypes.object.isRequired,
        notes: PropTypes.object.isRequired,
        photos: PropTypes.object.isRequired,
        default_photo: PropTypes.object.isRequired,
        division_events: PropTypes.object.isRequired,
        divided_from: PropTypes.object,
    }),
};

export default App;
