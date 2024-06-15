import React, { useState } from 'react';
import PropTypes from 'prop-types';
import useDebounce from 'src/useDebounce';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import { XMarkIcon, ArrowsUpDownIcon } from '@heroicons/react/16/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpLong, faArrowDownLong } from '@fortawesome/free-solid-svg-icons';

// Renders filter text input and sort dropdown at top of FilterColumn
const FilterInput = ({
    sortByKeys,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    handleInput
}) => {
    // Filter input state
    const [query, setQuery] = useState('');

    // Set local state and pass query to parent component callback
    const onChange = (query) => {
        setQuery(query);
        handleInput(query);
    };

    // Invert sort direction if selected key clicked again
    // Otherwise change selected key and set default direction
    const setSort = (keyName) => {
        if (keyName === sortKey) {
            setSortDirection(!sortDirection);
        } else {
            setSortKey(keyName);
            setSortDirection(true);
        }
        document.activeElement.blur();
    };

    // Indicates sort direction on selected option
    const Arrow = () => {
        if (sortDirection) {
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
                    {sortKey === keyName ? <Arrow /> : null}
                    {displayString}
                </a></li>
            );
        };

        Option.propTypes = {
            keyName: PropTypes.string,
            displayString: PropTypes.string
        };

        return (
            <div className="dropdown dropdown-end">
                <div
                    role="button"
                    tabIndex="0"
                    className="btn-close absolute right-2 top-2 h-8 w-8"
                >
                    <ArrowsUpDownIcon className="w-5 h-5 m-auto" />
                </div>
                <ul
                    tabIndex={0}
                    className={`menu menu-md dropdown-content mt-14 z-[99]
                                p-2 shadow bg-base-300 rounded-box w-min-content`}
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

    return (
        <div className="flex px-4 mb-4">
            <div className="relative w-full">
                <input
                    type="text"
                    className="input input-bordered w-full text-center indent-16 pr-20"
                    value={query}
                    onChange={e => onChange(e.target.value)}
                    placeholder="filter"
                />
                <button
                    className={
                        `btn-close absolute right-10 top-2 h-8 w-8
                        ${query ? 'opacity-100' : 'opacity-0 -z-10'}`
                    }
                    onClick={() => onChange('')}
                >
                    <XMarkIcon className="w-7 h-7 m-auto" />
                </button>
            </div>
            {sortByKeys.length ? <SortMenu /> : null}
        </div>
    );
};

FilterInput.propTypes = {
    sortByKeys: PropTypes.array,
    sortKey: PropTypes.string,
    setSortKey: PropTypes.func,
    sortDirection: PropTypes.bool,
    setSortDirection: PropTypes.func,
    handleInput: PropTypes.func
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
    // Contains array of contents objects matching current filter query
    const [current, setCurrent] = useState(contents);
    // Contains contents object key used to sort items
    const [sortKey, setSortKey] = useState(defaultSortKey);
    // Sort alphabetically if true, reverse alphabetically if false
    const [sortDirection, setSortDirection] = useState(true);

    // Called when user types in filter input
    // Filters contents after 200ms delay, or resets immediately if string empty
    const handleInput = (query) => {
        if (query) {
            filterContents(query);
        } else {
            setCurrent(contents);
        }
    };

    // Sets current to all items with an attribute that contains filter query
    // Debounced 200ms to prevent re-render on every keystroke
    const filterContents = useDebounce((query) => {
        const lowercaseQuery = query.toLowerCase();

        // Iterate over keys of each item, add the item to current state
        // once a single key is found that is not in ignoreKeys array and
        // has a value that contains filter query (case insensitive)
        setCurrent(contents.filter(item => {
            return Object.entries(item).some(([key, value]) => {
                return !ignoreKeys.includes(key)
                && value !== null
                && value.toString().toLowerCase().includes(lowercaseQuery);
            });
        }));
    }, 200);

    // Array.sort compare function used by sortByKey
    const compare = (a, b) => {
        if (a === null && b === null) return 0;
        if (a === null) return 1;
        if (b === null) return -1;
        return a > b ? 1 : -1;
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
        if (sortDirection) {
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
            title={`${title} (${Object.keys(current).length})`}
            openRef={openRef}
        >
            <FilterInput
                sortByKeys={sortByKeys}
                sortKey={sortKey}
                setSortKey={setSortKey}
                sortDirection={sortDirection}
                setSortDirection={setSortDirection}
                handleInput={handleInput}
            />
            <EditableNodeList editing={editing} selected={selected}>
                {sortByKey(current, sortKey).map((item) => {
                    // Render cardComponent by expanding params of each item
                    // Must have UUID param to use as react key
                    return <CardComponent key={item.uuid} {...item} />;
                })}
            </EditableNodeList>
            {children}
        </CollapseCol>
    );
};

FilterColumn.propTypes = {
    title: PropTypes.string,
    contents: PropTypes.array,
    CardComponent: PropTypes.func,
    editing: PropTypes.bool,
    selected: PropTypes.object,
    openRef: PropTypes.object,
    ignoreKeys: PropTypes.array,
    sortByKeys: PropTypes.array,
    defaultSortKey: PropTypes.string,
    children: PropTypes.node
};

export default FilterColumn;
