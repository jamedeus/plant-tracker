import PropTypes from 'prop-types';
import PlantCard from 'src/components/PlantCard';
import FilterColumn from 'src/components/FilterColumn';

const PlantsCol = ({ plants, editing, selectedPlants }) => {
    return (
        <FilterColumn
            title="Plants"
            contents={plants}
            CardComponent={PlantCard}
            editing={editing}
            selected={selectedPlants}
            ignoreKeys={[
                'uuid',
                'created',
                'last_watered',
                'last_fertilized',
                'thumbnail'
            ]}
            sortByKeys={[
                {key: 'created', display: 'Added'},
                {key: 'display_name', display: 'Name'},
                {key: 'species', display: 'Species'},
                {key: 'last_watered', display: 'Watered'}
            ]}
            defaultSortKey='created'
            storageKey='overviewPlantsColumn'
        />
    );
};

PlantsCol.propTypes = {
    plants: PropTypes.array.isRequired,
    editing: PropTypes.bool.isRequired,
    selectedPlants: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
};

export default PlantsCol;
