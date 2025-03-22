import PropTypes from 'prop-types';
import GroupCard from 'src/components/GroupCard';
import FilterColumn from 'src/components/FilterColumn';

const GroupsCol = ({ groups, editing, selectedGroupsRef }) => {
    return (
        <FilterColumn
            title="Groups"
            contents={groups}
            CardComponent={GroupCard}
            editing={editing}
            formRef={selectedGroupsRef}
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
    selectedGroupsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired
};

export default GroupsCol;
