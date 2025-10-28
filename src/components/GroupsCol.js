import PropTypes from 'prop-types';
import GroupCard from 'src/components/GroupCard';
import FilterColumn from 'src/components/FilterColumn';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

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
const GroupsCol = ({ groups, editing, selectionController, onStartEditing, storageKey, onOpenTitle, children }) => {
    return (
        <FilterColumn
            title="Groups"
            onOpenTitle={onOpenTitle}
            contents={Object.values(groups)}
            CardComponent={GroupCard}
            editing={editing}
            controller={selectionController}
            onStartEditing={onStartEditing}
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
    selectionController: controllerPropTypes.isRequired,
    onStartEditing: PropTypes.func,
    storageKey: PropTypes.string,
    onOpenTitle: PropTypes.func,
    children: PropTypes.node
};

export default GroupsCol;
