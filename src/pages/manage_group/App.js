import React from 'react';
import PropTypes from 'prop-types';
import EditGroupModal from './EditGroupModal';
import AddPlantsModal from './AddPlantsModal';
import 'src/css/index.css';
import Layout from './Layout';
import { ReduxProvider } from './store';

function App({ initialState }) {
    return (
        <ReduxProvider initialState={initialState}>
            <Layout />
            <EditGroupModal />
            <AddPlantsModal />
        </ReduxProvider>
    );
}

export default App;

App.propTypes = {
    initialState: PropTypes.shape({
        group_details: PropTypes.object.isRequired,
        plants: PropTypes.object.isRequired
    }).isRequired
};
