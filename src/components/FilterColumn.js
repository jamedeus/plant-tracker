import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Renders CollapseCol with EditableNodeList and text input to filter contents
//
// Takes title string, contents (array of objects), CardComponent (functional
// component rendered for each item in contents, must take args matching object
// keys), EditableNodeList args (editing bool state + selected ref), and
// CollapseCol openRef (ref containing bool)
//
// Optional ignoreKeys array allows filter to skip certain contents object keys
//
// Contents objects must have uuid (react key) and name (used to filter) keys
const FilterColumn = ({title, contents, CardComponent, editing, selected, openRef, ignoreKeys=[], children}) => {
    const [query, setQuery] = useState('');
    const [current, setCurrent] = useState(contents);

    // Filter contents to items with an attribute that contains filter query
    useEffect(() => {
        if (query) {
            // Convert filter query to lowercase once (instead of each loop)
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
        } else {
            setCurrent(contents);
        }
    }, [query]);

    // Reset filter string and current contents when upstream contents changes
    // Prevents removed items staying in list, new items failing to appear, etc
    useEffect(() => {
        setQuery('');
        setCurrent(contents);
    }, [contents]);

    return (
        <CollapseCol
            title={`${title} (${Object.keys(current).length})`}
            openRef={openRef}
        >
            <div className="px-4 mb-4 relative">
                <input
                    type="text"
                    className="input input-bordered w-full text-center pr-10"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="filter"
                    style={{textIndent: '1.625rem'}}
                />
                <button
                    className={
                        `btn-close absolute right-6 top-2
                        ${query ? 'opacity-100' : 'opacity-0 -z-10'}`
                    }
                    onClick={() => setQuery('')}
                >
                    <XMarkIcon className="w-8 h-8" />
                </button>
            </div>
            <EditableNodeList editing={editing} selected={selected}>
                {current.map((item) => {
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
    children: PropTypes.node
};

export default FilterColumn;
