import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Renders CollapseCol with EditableNodeList and text input to filter contents
//
// Takes title string, contents (array of objects), cardComponent (functional
// component rendered for each item in contents, must take args matching object
// keys), and EditableNodeList args (editing bool state + selected ref)
//
// Contents objects must have uuid (react key) and name (used to filter) keys
const FilterColumn = ({title, contents, cardComponent, editing, selected, children}) => {
    const [query, setQuery] = useState('');
    const [current, setCurrent] = useState(contents);

    // Filter contents to items with any attribute that contains filter query
    useEffect(() => {
        if (query) {
            setCurrent(contents.filter(item => {
                // Ignore UUID to prevent single characters matching everything
                // Ignore timestamps to prevent numbers matching everything
                const {
                    uuid, last_watered, last_fertilized, ...otherProps
                } = item;
                return Object.values(otherProps)
                             .toString()
                             .toLowerCase()
                             .includes(query.toLowerCase());
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
        <CollapseCol title={`${title} (${Object.keys(current).length})`}>
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
                    return React.createElement(
                        cardComponent,
                        {...item, key: item.uuid}
                    );
                })}
            </EditableNodeList>
            {children}
        </CollapseCol>
    );
};

FilterColumn.propTypes = {
    title: PropTypes.string,
    contents: PropTypes.array,
    cardComponent: PropTypes.func,
    editing: PropTypes.bool,
    selected: PropTypes.object,
    children: PropTypes.node
};

export default FilterColumn;
