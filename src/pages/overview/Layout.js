import PropTypes from 'prop-types';
import Setup from './Setup';
import PlantsCol from 'src/components/PlantsCol';
import GroupsCol from 'src/components/GroupsCol';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus } from 'react-icons/fa6';

// Render correct components for current state objects
const Layout = ({
    plants,
    groups,
    selectedPlantsRef,
    selectedGroupsRef,
    editing,
    toggleEditing,
    plantsColRef,
    groupsColRef,
    archivedOverview
}) => {
    // Determines if 2-column layout or single centered column
    const hasPlants = Object.keys(plants).length > 0;
    const hasGroups = Object.keys(groups).length > 0;
    const twoColumns = hasPlants && hasGroups;

    return (
        <div className={clsx(
            'grid grid-cols-1 mx-auto px-4',
            twoColumns && 'md:grid-cols-2'
        )}>
            {/* Render plants column if 1 or more plants exist */}
            {hasPlants && (
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
                        onOpenTitle={toggleEditing}
                    >
                        {!archivedOverview && (
                            <a
                                className="btn btn-accent mx-auto mt-4"
                                href={`/manage/${uuidv4()}`}
                                aria-label="Register new plant"
                            >
                                <FaPlus className="size-5 mr-1" /> Add plant
                            </a>
                        )}
                    </PlantsCol>
                </div>
            )}
            {/* Render groups column if 1 or more groups exist */}
            {hasGroups && (
                <div
                    className={clsx(
                        'scroll-mt-20 relative',
                        twoColumns && 'md:ml-12'
                    )}
                    ref={groupsColRef}
                >
                    <GroupsCol
                        groups={groups}
                        editing={editing}
                        formRef={selectedGroupsRef}
                        storageKey='overviewGroupsColumn'
                        onOpenTitle={toggleEditing}
                    >
                        {!archivedOverview && (
                            <a
                                className="btn btn-accent mx-auto mt-4"
                                href={`/manage/${uuidv4()}?type=group`}
                                aria-label="Register new group"
                            >
                                <FaPlus className="size-5 mr-1" /> Add group
                            </a>
                        )}
                    </GroupsCol>
                </div>
            )}
            {/* Render setup instructions if database is empty */}
            {!hasPlants && !hasGroups && (
                <Setup />
            )}
        </div>
    );
};

Layout.propTypes = {
    plants: PropTypes.object.isRequired,
    groups: PropTypes.object.isRequired,
    selectedPlantsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    selectedGroupsRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    editing: PropTypes.bool.isRequired,
    toggleEditing: PropTypes.func.isRequired,
    plantsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    archivedOverview: PropTypes.bool.isRequired
};

export default Layout;
