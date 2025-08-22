import React from 'react';
import PropTypes from 'prop-types';
import Layout from './Layout';
import PrintModal from './PrintModal';
import { ReduxProvider } from './store';
import 'src/css/index.css';

function App({ initialState }) {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <PrintModal />
        </ReduxProvider>
    );
}

App.propTypes = {
    initialState: PropTypes.shape({
        plants: PropTypes.object.isRequired,
        groups: PropTypes.object.isRequired,
        show_archive: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired,
    }),
};

export default App;
