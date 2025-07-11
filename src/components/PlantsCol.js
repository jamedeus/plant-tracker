import PropTypes from 'prop-types';
import PlantCard from 'src/components/PlantCard';
import FilterColumn from 'src/components/FilterColumn';

// Populates sort dropdown options
const SORT_BY_KEYS = [
    { key: 'created', display: 'Added'},
    { key: 'display_name', display: 'Name' },
    { key: 'species', display: 'Species' },
    { key: 'last_watered', display: 'Watered' }
];

// Plant keys skipped when searching for strings matching filter input query
const IGNORE_KEYS = [
    'uuid',
    'created',
    'last_watered',
    'last_fertilized',
    'thumbnail'
];

// Renders FilterColumn with PlantCard for each item in plants param (array)
const PlantsCol = ({ plants, editing, formRef, storageKey, titleOptions, onOpenTitle, children }) => {
    return (
        <FilterColumn
            title="Plants"
            titleOptions={titleOptions}
            onOpenTitle={onOpenTitle}
            contents={Object.values(plants)}
            CardComponent={PlantCard}
            editing={editing}
            formRef={formRef}
            ignoreKeys={IGNORE_KEYS}
            sortByKeys={SORT_BY_KEYS}
            defaultSortKey='created'
            storageKey={storageKey}
        >
            {children}
        </FilterColumn>
    );
};

PlantsCol.propTypes = {
    plants: PropTypes.objectOf(
        PropTypes.exact({
            name: PropTypes.string,
            display_name: PropTypes.string.isRequired,
            uuid: PropTypes.string.isRequired,
            created: PropTypes.string.isRequired,
            species: PropTypes.string,
            description: PropTypes.string,
            pot_size: PropTypes.number,
            last_watered: PropTypes.string,
            last_fertilized: PropTypes.string,
            thumbnail: PropTypes.string,
            archived: PropTypes.bool.isRequired,
            group: PropTypes.exact({
                name: PropTypes.string.isRequired,
                uuid: PropTypes.string.isRequired
            })
        })
    ).isRequired,
    editing: PropTypes.bool.isRequired,
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    storageKey: PropTypes.string,
    titleOptions: PropTypes.node,
    onOpenTitle: PropTypes.func,
    children: PropTypes.node
};

export default PlantsCol;
