import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import 'src/css/index.css';
import LazyModal, { useModal } from 'src/components/LazyModal';
import initialStatePropTypes from './initialStatePropTypes';
import {
    setNoteModalHandle,
    setRepotModalHandle,
    setDivisionModalHandle
} from './modals';

const App = ({ initialState }) => {
    const noteModal = useModal();
    setNoteModalHandle(noteModal);

    const repotModal = useModal();
    setRepotModalHandle(repotModal);

    const divisionModal = useModal();
    setDivisionModalHandle(divisionModal);

    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <Settings />
            <LazyModal
                ref={noteModal.ref}
                ariaLabel="Add/edit note"
                load={() => import(/* webpackChunkName: "manage_plant_note-modal" */ "./NoteModal")}
            />

            <LazyModal
                ref={repotModal.ref}
                title="Repot Plant"
                ariaLabel="Repot plant"
                load={() => import(/* webpackChunkName: "manage_plant_repot-modal" */ "./RepotModal")}
            />

            <LazyModal
                ref={divisionModal.ref}
                title="Divide Plant"
                ariaLabel="Divide plant"
                keepContents={true}
                load={() => import(/* webpackChunkName: "manage_plant_division-modal" */ "./DivisionModal")}
            />
        </ReduxProvider>
    );
};

App.propTypes = {
    initialState: initialStatePropTypes.isRequired
};

export default App;
