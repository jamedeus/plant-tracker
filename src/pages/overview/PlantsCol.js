import PropTypes from 'prop-types';
import PlantCard from 'src/components/PlantCard';
import FilterColumn from 'src/components/FilterColumn';

const PlantsCol = ({ plants, editing, selectedPlantsRef }) => {
    return (
        <FilterColumn
            title="Plants"
            contents={plants}
            CardComponent={PlantCard}
            editing={editing}
            formRef={selectedPlantsRef}
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
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired
};

export default PlantsCol;
