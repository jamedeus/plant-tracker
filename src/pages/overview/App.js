import React from 'react';
import PropTypes from 'prop-types';
import Layout from './Layout';
import { ReduxProvider } from './store';
import 'src/css/index.css';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

function App({ initialState }) {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
        </ReduxProvider>
    );
}

App.propTypes = {
    initialState: PropTypes.shape({
        plants: PropTypes.objectOf(plantDetailsProptypes).isRequired,
        groups: PropTypes.objectOf(groupDetailsProptypes).isRequired,
        show_archive: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired,
    }),
};

export default App;
