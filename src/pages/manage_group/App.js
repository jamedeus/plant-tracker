import React from 'react';
import PropTypes from 'prop-types';
import AddPlantsModal from './AddPlantsModal';
import 'src/css/index.css';
import Layout from './Layout';
import { ReduxProvider } from './store';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

function App({ initialState }) {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <AddPlantsModal />
        </ReduxProvider>
    );
}

export default App;

App.propTypes = {
    initialState: PropTypes.shape({
        group_details: groupDetailsProptypes.isRequired,
        plants: PropTypes.objectOf(plantDetailsProptypes).isRequired,
    }).isRequired
};
