import PropTypes from 'prop-types';
import GroupCard from 'src/components/GroupCard';
import FilterColumn from 'src/components/FilterColumn';

const GroupsCol = ({ groups, editing, selectedGroups }) => {
    return (
        <FilterColumn
            title="Groups"
            contents={groups}
            CardComponent={GroupCard}
            editing={editing}
            selected={selectedGroups}
            ignoreKeys={[
                'uuid',
                'created'
            ]}
            sortByKeys={[
                {key: 'created', display: 'Added'},
                {key: 'name', display: 'Name'},
                {key: 'location', display: 'Location'}
            ]}
            defaultSortKey='created'
            storageKey='overviewGroupsColumn'
        />
    );
};

GroupsCol.propTypes = {
    groups: PropTypes.array.isRequired,
    editing: PropTypes.bool.isRequired,
    selectedGroups: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
};

export default GroupsCol;
