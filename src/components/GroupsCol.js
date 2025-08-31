import PropTypes from 'prop-types';
import GroupCard from 'src/components/GroupCard';
import FilterColumn from 'src/components/FilterColumn';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

// Populates sort dropdown options
const SORT_BY_KEYS = [
    { key: 'created', display: 'Added'},
    { key: 'name', display: 'Name' },
    { key: 'location', display: 'Location' }
];

// Group keys skipped when searching for strings matching filter input query
const IGNORE_KEYS = [
    'uuid',
    'created'
];

// Renders FilterColumn with GroupCard for each item in groups param (array)
const GroupsCol = ({ groups, editing, formRef, storageKey, onOpenTitle, children }) => {
    return (
        <FilterColumn
            title="Groups"
            onOpenTitle={onOpenTitle}
            contents={Object.values(groups)}
            CardComponent={GroupCard}
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

GroupsCol.propTypes = {
    groups: PropTypes.objectOf(groupDetailsProptypes).isRequired,
    editing: PropTypes.bool.isRequired,
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    storageKey: PropTypes.string,
    onOpenTitle: PropTypes.func,
    children: PropTypes.node
};

export default GroupsCol;
