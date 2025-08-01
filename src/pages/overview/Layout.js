import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import Setup from './Setup';
import EditModeFooter from './EditModeFooter';
import AddEventsFooter from 'src/components/AddEventsFooter';
import PlantsCol from 'src/components/PlantsCol';
import GroupsCol from 'src/components/GroupsCol';
import { hideToast } from 'src/components/Toast';
import DropdownMenu from 'src/components/DropdownMenu';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus } from 'react-icons/fa6';

// Render correct components for current state objects
const Layout = ({
    plants,
    groups,
    setPlants,
    setGroups,
    plantsColRef,
    groupsColRef,
    archivedOverview,
    setShowArchive
}) => {
    // Determines if 2-column layout or single centered column
    const hasPlants = Object.keys(plants).length > 0;
    const hasGroups = Object.keys(groups).length > 0;
    const twoColumns = hasPlants && hasGroups;

    // FormRefs for PlantsCol and GroupsCol, used to read user selection
    const selectedPlantsRef = useRef(null);
    const selectedGroupsRef = useRef(null);

    // States to control edit and add events modes (shows checkboxes when true)
    // Renders EditModeFooter and AddEventsFooter respectively when true
    const [editing, setEditing] = useState(false);
    const [addingEvents, setAddingEvents] = useState(false);

    const toggleEditing = useCallback(() => {
        setEditing(!editing);
        setAddingEvents(false);
        hideToast();
        document.activeElement.blur();
    }, [editing]);

    const toggleAddingEvents = useCallback(() => {
        setAddingEvents(!addingEvents);
        setEditing(false);
        hideToast();
        document.activeElement.blur();
    }, [addingEvents]);

    return (
        <>
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
                            editing={editing || addingEvents}
                            formRef={selectedPlantsRef}
                            storageKey='overviewPlantsColumn'
                            // Archived overview: Click title to enter edit mode
                            onOpenTitle={archivedOverview ? toggleEditing : null}
                            // Main overview: Show add events and edit options
                            titleOptions={archivedOverview ? null : (
                                <DropdownMenu>
                                    <li><a
                                        className="flex justify-center"
                                        onClick={toggleAddingEvents}
                                        data-testid="add_plants_option"
                                    >
                                        Add events
                                    </a></li>
                                    <li><a
                                        className="flex justify-center"
                                        onClick={toggleEditing}
                                        data-testid="edit_plants_option"
                                    >
                                        Edit plants
                                    </a></li>
                                </DropdownMenu>
                            )}
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

            <EditModeFooter
                visible={editing}
                selectedPlantsRef={selectedPlantsRef}
                selectedGroupsRef={selectedGroupsRef}
                plants={plants}
                groups={groups}
                setPlants={setPlants}
                setGroups={setGroups}
                setEditing={setEditing}
                archivedOverview={archivedOverview}
                setShowArchive={setShowArchive}
            />

            {!archivedOverview &&
                <AddEventsFooter
                    visible={addingEvents}
                    onClose={() => setAddingEvents(false)}
                    selectedPlantsRef={selectedPlantsRef}
                    plants={plants}
                    setPlants={setPlants}
                />
            }
        </>
    );
};

Layout.propTypes = {
    plants: PropTypes.object.isRequired,
    groups: PropTypes.object.isRequired,
    setPlants: PropTypes.func.isRequired,
    setGroups: PropTypes.func.isRequired,
    plantsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    archivedOverview: PropTypes.bool.isRequired,
    setShowArchive: PropTypes.func.isRequired
};

export default Layout;
