import Layout from './Layout';
import { ReduxProvider } from './store';
import Settings from './Settings';
import 'src/css/index.css';
import LazyModal, { useModal } from 'src/components/LazyModal';
import { setNoteModalHandle } from './modals';
import initialStatePropTypes from './initialStatePropTypes';

const App = ({ initialState = null }) => {
    const noteModal = useModal();
    setNoteModalHandle(noteModal);

    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <Settings />
            <LazyModal
                ref={noteModal.ref}
                ariaLabel="Add/edit note"
                load={() => import(/* webpackChunkName: "note-modal" */ "./NoteModal")}
            />
        </ReduxProvider>
    );
};

App.propTypes = {
    initialState: initialStatePropTypes.isRequired
};

export default App;
