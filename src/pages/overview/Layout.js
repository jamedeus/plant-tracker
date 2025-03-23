import PropTypes from 'prop-types';
import Setup from './Setup';
import PlantsCol from 'src/components/PlantsCol';
import GroupsCol from 'src/components/GroupsCol';
import clsx from 'clsx';

// Render correct components for current state objects
const Layout = ({ plants, groups, selectedPlantsRef, selectedGroupsRef, editing, plantsColRef, groupsColRef }) => {
    // Determines if 2-column layout or single centered column
    const twoColumns = plants.length > 0 && groups.length > 0;

    return (
        <div className={clsx(
            'grid grid-cols-1 mx-auto',
            twoColumns && 'md:grid-cols-2'
        )}>
            {/* Render plants column if 1 or more plants exist */}
            {plants.length > 0 && (
                <div
                    className={clsx(
                        'scroll-mt-20',
                        twoColumns && 'md:mr-12 mb-8 md:mb-0'
                    )}
                    ref={plantsColRef}
                >
                    <PlantsCol
                        plants={plants}
                        editing={editing}
                        formRef={selectedPlantsRef}
                        storageKey='overviewPlantsColumn'
                    />
                </div>
            )}
            {/* Render groups column if 1 or more groups exist */}
            {groups.length > 0 && (
                <div
                    className={clsx(
                        'scroll-mt-20',
                        twoColumns && 'md:ml-12'
                    )}
                    ref={groupsColRef}
                >
                    <GroupsCol
                        groups={groups}
                        editing={editing}
                        formRef={selectedGroupsRef}
                        storageKey='overviewGroupsColumn'
                    />
                </div>
            )}
            {/* Render setup instructions if database is empty */}
            {plants.length === 0 && groups.length === 0 && (
                <Setup />
            )}
        </div>
    );
};

Layout.propTypes = {
    plants: PropTypes.array.isRequired,
    groups: PropTypes.array.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    selectedGroupsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    editing: PropTypes.bool.isRequired,
    plantsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired
};

export default Layout;
