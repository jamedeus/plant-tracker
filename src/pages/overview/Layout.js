import PropTypes from 'prop-types';
import Setup from './Setup';
import PlantsCol from 'src/components/PlantsCol';
import GroupsCol from 'src/components/GroupsCol';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { PlusIcon } from '@heroicons/react/24/outline';

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
                        'scroll-mt-20 relative',
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
                    />
                    {!archivedOverview && (
                        <div className="absolute flex top-3 right-2 z-55">
                            <a
                                className="btn-close"
                                href={`/manage/${uuidv4()}`}
                                aria-label="Register new plant"
                            >
                                <PlusIcon className="size-6" />
                            </a>
                        </div>
                    )}
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
                    />
                    {!archivedOverview && (
                        <div className="absolute flex top-3 right-2 z-55">
                            <a
                                className="btn-close"
                                href={`/manage/${uuidv4()}?type=group`}
                                aria-label="Register new group"
                            >
                                <PlusIcon className="size-6" />
                            </a>
                        </div>
                    )}
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
