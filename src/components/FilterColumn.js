import React, { useState, useEffect, useReducer } from 'react';
import PropTypes from 'prop-types';
import useDebounce from 'src/useDebounce';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import { XMarkIcon, ArrowsUpDownIcon } from '@heroicons/react/16/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpLong, faArrowDownLong } from '@fortawesome/free-solid-svg-icons';

// Reducer used to set visible cards, sort key, and sort direction
const reducer = (state, action) => {
    switch(action.type) {
        case('set_sort'): {
            return {
                ...state,
                sortKey: action.sortKey,
                sortDirection: action.sortDirection
            };
        }
        case('set_contents'): {
            return {
                ...state,
                originalContents: action.contents,
                currentContents: action.contents
            };
        }
        case('filter_contents'): {
            // Case-insensitive matching
            const lowercaseQuery = action.query.toLowerCase();

            // Iterate over keys of each item in state.originalContents, add
            // item to currentContents once a single key is found that is not
            // in state.ignoreKeys array and has a value that contains query
            const newContents = state.originalContents.filter(item => {
                return Object.entries(item).some(([key, value]) => {
                    return !state.ignoreKeys.includes(key)
                    && value !== null
                    && value.toString().toLowerCase().includes(lowercaseQuery);
                });
            });

            return {
                ...state,
                currentContents: newContents
            };
        }
        default: {
            throw Error('Unknown action: ' + action.type);
        }
    }
};


// Renders filter text input and sort dropdown at top of FilterColumn
const FilterInput = ({state, dispatch, sortByKeys}) => {
    // Filter input state
    const [query, setQuery] = useState('');

    // Called when user types in filter input
    // Filters contents after 200ms delay, resets immediately if string empty
    const handleInput = (query) => {
        setQuery(query);
        if (query) {
            filterContents(query);
        } else {
            dispatch({type: 'filter_contents', query: ''});
        }
    };

    // Filters visible cards to all items with an attribute that contains query
    // Debounced 200ms to prevent re-render on every keystroke
    const filterContents = useDebounce((query) => {
        dispatch({type: 'filter_contents', query: query});
    }, 200);

    // Invert sort direction if selected key clicked again
    // Otherwise change selected key and set default direction
    const setSort = (keyName) => {
        if (keyName === state.sortKey) {
            dispatch({
                type: 'set_sort',
                sortKey: state.sortKey,
                sortDirection: !state.sortDirection
            });
        } else {
            dispatch({
                type: 'set_sort',
                sortKey: keyName,
                sortDirection: true
            });
        }
        document.activeElement.blur();
    };

    // Indicates sort direction on selected option
    const Arrow = () => {
        if (state.sortDirection) {
            return <FontAwesomeIcon icon={faArrowDownLong} />;
        } else {
            return <FontAwesomeIcon icon={faArrowUpLong} />;
        }
    };

    // Dropdown button rendered next to filter input, used to sort column
    // Only rendered if sortByKeys array is not empty
    const SortMenu = () => {
        const Option = ({keyName, displayString}) => {
            return (
                <li className="ml-auto"><a onClick={() => setSort(keyName)}>
                    {state.sortKey === keyName ? <Arrow /> : null}
                    {displayString}
                </a></li>
            );
        };

        Option.propTypes = {
            keyName: PropTypes.string.isRequired,
            displayString: PropTypes.string.isRequired
        };

        return (
            <div className="dropdown dropdown-end">
                <div
                    role="button"
                    tabIndex="0"
                    className="btn-close h-8 w-8 no-animation"
                >
                    <ArrowsUpDownIcon className="w-5 h-5 m-auto" />
                </div>
                <ul
                    tabIndex={0}
                    className={`menu menu-md dropdown-content mt-2 z-[99] p-2
                                shadow bg-base-300 rounded-box w-min-content`}
                >
                    {sortByKeys.map((key) => {
                        return <Option
                            key={key.key}
                            keyName={key.key}
                            displayString={key.display}
                        />;
                    })}
                </ul>
            </div>
        );
    };

    // Button to clear input, appears when user types query
    const ClearButton = () => {
        return (
            <button
                className="btn-close h-8 w-8 no-animation"
                onClick={() => handleInput('')}
            >
                <XMarkIcon className="w-7 h-7 m-auto" />
            </button>
        );
    };

    return (
        <div className="flex px-4 mb-4">
            <div className="relative w-full">
                <input
                    type="text"
                    className={`input input-bordered w-full text-center
                                ${sortByKeys.length
                                    ? 'indent-[3.625rem] pr-[4.5rem]'
                                    : 'indent-[1.625rem] pr-10'}`}
                    value={query}
                    onChange={e => handleInput(e.target.value)}
                    placeholder="filter"
                />
                <div className="absolute flex top-2 right-2">
                    {query ? <ClearButton /> : null}
                    {sortByKeys.length ? <SortMenu /> : null}
                </div>
            </div>
        </div>
    );
};

FilterInput.propTypes = {
    state: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    sortByKeys: PropTypes.array.isRequired
};

// Renders CollapseCol with EditableNodeList, text input used to filter visible
// items, and dropdown used to sort contents.
//
// Args:
// - title: String displayed at top of column.
// - contents: Array of objects with attributes matching the args expected by
//   CardComponent, used to render cards in EditableNodeList.
// - CardComponent: A JSX component rendered for each item in contents.
// - editing: Bool that controls EditableNodeList checkbox visibility.
// - selected: Ref containing array, receives selected EditableNodeList items.
// - openRef: Ref containing bool, persists CollapseCol state after re-render.
// - ignoreKeys: Array of strings matching attributes in contents objects that
//   should be ignored when user types in filter input.
// - sortByKeys: Array of objects with `key` and display attributes, populates
//   sort dropdown options (key must match an attribute in contents objects).
// - defaultSortKey: Key from contents objects used for default sort.
//
const FilterColumn = ({
    title,
    contents,
    CardComponent,
    editing,
    selected,
    openRef,
    ignoreKeys=[],
    sortByKeys=[],
    defaultSortKey=null,
    children
}) => {
    // sortKey: contents object key used to sort items
    // sortDirection: alphabetical if true, reverse alphabetical if false
    // currentContents: array of contents objects matching current filter query
    // originalContents: full array of contents objects (ignores filter query)
    // ignoreKeys: array of contents object keys ignored by filter function
    const [state, dispatch] = useReducer(reducer, {
        sortKey: defaultSortKey,
        sortDirection: true,
        currentContents: contents,
        originalContents: contents,
        ignoreKeys: ignoreKeys
    });

    // Update state.originalContents when upstream contents changes
    // Will not re-render when contents changes unless parent re-renders
    useEffect(() => {
        dispatch({type: 'set_contents', contents: contents});
    }, [contents]);

    // Array.sort compare function used by sortByKey
    const compare = (a, b) => {
        if (a === null && b === null) return 0;
        if (a === null) return 1;
        if (b === null) return -1;
        return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
    };

    // Takes array of objects and one of their keys
    // Returns array sorted alphabetically by value of key
    // Items where key is null are sorted to bottom
    const sortByKey = (items, key) => {
        // Return unchanged if sortKey not set
        if (!key) {
            return items;
        }

        // Sort alphabetically if sortDirection is true, reverse if false
        if (state.sortDirection) {
            const sorted = [...items].sort((a, b) => {
                return compare(a[key], b[key]);
            });
            return sorted;
        } else {
            const sorted = [...items].sort((a, b) => {
                return -compare(a[key], b[key]);
            });
            return sorted;
        }
    };

    return (
        <CollapseCol
            title={`${title} (${Object.keys(state.currentContents).length})`}
            openRef={openRef}
        >
            <FilterInput
                sortByKeys={sortByKeys}
                state={state}
                dispatch={dispatch}
            />
            <EditableNodeList editing={editing} selected={selected}>
                {sortByKey(state.currentContents, state.sortKey).map((item) => {
                    // Render cardComponent by expanding params of each item
                    // Must have UUID param to use as react key
                    // Disable page links in edit mode
                    return (
                        <CardComponent
                            key={item.uuid}
                            {...item}
                            linkPage={!editing}
                        />
                    );
                })}
            </EditableNodeList>
            {children}
        </CollapseCol>
    );
};

FilterColumn.propTypes = {
    title: PropTypes.string.isRequired,
    contents: PropTypes.array.isRequired,
    CardComponent: PropTypes.func.isRequired,
    editing: PropTypes.bool,
    selected: PropTypes.shape({
        current: PropTypes.array
    }).isRequired,
    openRef: PropTypes.object.isRequired,
    ignoreKeys: PropTypes.array,
    sortByKeys: PropTypes.array,
    defaultSortKey: PropTypes.string,
    children: PropTypes.node
};

export default FilterColumn;
