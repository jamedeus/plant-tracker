import PlantCard from '../PlantCard';
import FilterColumn from '../FilterColumn';

const plants = [
    {
        name: "mini palm tree",
        display_name: "mini palm tree",
        uuid: "49a55f1f-5703-4f5e-acad-2c0991a08806",
        created: "2023-12-20T01:25:12+00:00",
        species: "Parlor Palm",
        description: "Palms aren't really trees",
        pot_size: 6,
        last_watered: "2024-02-26T05:45:44+00:00",
        last_fertilized: "2024-03-01T05:45:44+00:00",
        thumbnail: "/media/thumbnails/IMG_8000_thumb.webp"
    },
    {
        name: null,
        display_name: "Unnamed Fittonia",
        uuid: "6e8b3664-9b5a-4bc9-a62f-50f89a4c3aaf",
        created: "2023-12-22T01:25:12+00:00",
        species: "Fittonia",
        description: null,
        pot_size: 4,
        last_watered: null,
        last_fertilized: "2024-03-01T05:45:44+00:00",
        thumbnail: "/media/thumbnails/IMG_8001_thumb.webp"
    },
    {
        name: null,
        display_name: "Unnamed plant 1",
        uuid: "645f3149-dd59-4419-b9a2-d8c796fa29e1",
        created: "2023-12-24T01:25:12+00:00",
        species: null,
        description: null,
        pot_size: 8,
        last_watered: "2024-02-28T05:45:44+00:00",
        last_fertilized: "2024-03-01T05:45:44+00:00",
        thumbnail: "/media/thumbnails/IMG_8002_thumb.webp"
    },
    {
        name: null,
        display_name: "Unnamed plant 2",
        uuid: "67337371-d65a-4c0b-b32b-49a20d043495",
        created: "2023-12-27T03:51:32+00:00",
        species: null,
        description: null,
        pot_size: 2,
        last_watered: "2024-03-02T04:31:20+00:00",
        last_fertilized: "2024-03-02T04:31:20+00:00",
        thumbnail: "/media/thumbnails/IMG_8004_thumb.webp"
    },
    {
        name: "Favorite plant",
        display_name: "Favorite plant",
        uuid: "9c9d1767-a97f-4ca8-ad6e-b706ff943ff2",
        created: "2023-12-26T01:25:12+00:00",
        species: "Calathea",
        description: null,
        pot_size: 14,
        last_watered: null,
        last_fertilized: "2024-03-01T05:45:44+00:00",
        thumbnail: "/media/thumbnails/IMG_8003_thumb.webp"
    },
];

describe('FilterColumn', () => {
    let component, user;

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render component + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        component = render(
            <FilterColumn
                title="Plants"
                contents={plants}
                CardComponent={PlantCard}
                editing={false}
                formRef={jest.fn()}
                selected={{current: []}}
                ignoreKeys={[
                    'uuid',
                    'created',
                    'last_watered',
                    'last_fertilized',
                    'thumbnail'
                ]}
                sortByKeys={[
                    {key: 'created', display: 'Added'},
                    {key: 'display_name', display: 'Name'},
                    {key: 'species', display: 'Species'},
                    {key: 'last_watered', display: 'Watered'}
                ]}
                defaultSortKey='created'
            />
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('renders expected default state', () => {
        // Confirm a card was rendered for each item in contents array
        expect(component.container.querySelectorAll('.card').length).toBe(5);

        // Confirm the sort dropdown contains the options set in sortByKeys arg
        const menu = component.container.querySelector('ul.dropdown-content');
        expect(menu.children[0].children[0].innerHTML).toContain('Added');
        expect(menu.children[1].children[0].innerHTML).toBe('Name');
        expect(menu.children[2].children[0].innerHTML).toBe('Species');
        expect(menu.children[3].children[0].innerHTML).toBe('Watered');

        // Confirm there is a down arrow icon next to the default option
        expect(menu.children[0].children[0].innerHTML).toContain('svg');
        expect(menu.children[0].children[0].innerHTML).toContain('fa-arrow-down-long');
    });

    it('filters visible cards when user types in the filter input', async () => {
        // Type "plant", should only show "Unnamed plant 1", "Unnamed plant 2",
        // and "Favorite plant"
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(3);
        expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "calathea", should only show "Favorite plant" (matches species)
        await user.clear(filterInput);
        await user.type(filterInput, 'calathea');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "6", should only show "mini palm tree" (matches 6 inch pot)
        await user.clear(filterInput);
        await user.type(filterInput, '6');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('mini palm tree')).toBeInTheDocument();

        // Type "really", should only show "mini palm tree" (matches description)
        await user.clear(filterInput);
        await user.type(filterInput, 'really');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('mini palm tree')).toBeInTheDocument();
    });

    it('does not match the keys in ignoreKeys arg when filtering', async () => {
        // Type part of UUID, should remove all cards
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, '2c0991a08806');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Type part of timestamp, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Type part of thumbnail URL, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, 'IMG_8');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(0);
    });

    it('clears the filter input when X button is clcked', async () => {
        // Type random characters in field, confirm no cards visible
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'ffduiwafh');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Click clear button, confirm all 4 cards reappear
        await user.click(component.getByTitle("Clear filter input"));
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(5);
    });

    it('sorts cards correctly when sort dropdown option is clicked', async () => {
        // Get array of card titles, confirm expected default order
        let titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("mini palm tree");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("Unnamed plant 1");
        expect(titles[3].innerHTML).toBe("Favorite plant");
        expect(titles[4].innerHTML).toBe("Unnamed plant 2");

        // Click the Name option in sort dropdown
        await user.click(component.getByText('Name'));

        // Confirm cards were sorted alphabetically by name (case insensitive)
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Favorite plant");
        expect(titles[1].innerHTML).toBe("mini palm tree");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("Unnamed plant 1");
        expect(titles[4].innerHTML).toBe("Unnamed plant 2");

        // Confirm a down arrow icon appeared next to name
        let nameOption = component.getByText('Name').closest('li');
        expect(nameOption.querySelector('.fa-arrow-down-long')).not.toBeNull();

        // Click the Name option again to reverse sort order
        await user.click(component.getByText('Name'));

        // Confirm cards were sorted reverse alphabetically by name
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 2");
        expect(titles[1].innerHTML).toBe("Unnamed plant 1");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("mini palm tree");
        expect(titles[4].innerHTML).toBe("Favorite plant");

        // Confirm the down arrow was replaced by an up arrow
        nameOption = component.getByText('Name').closest('li');
        expect(nameOption.querySelector('.fa-arrow-down-long')).toBeNull();
        expect(nameOption.querySelector('.fa-arrow-up-long')).not.toBeNull();
    });

    it('sorts items where selected key is null to end of list', async () => {
        // Click the Species option in sort dropdown
        await user.click(component.getByText('Species'));

        // Confirm cards sorted alphabetically, plants without species are last
        let titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Favorite plant");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("mini palm tree");
        expect(titles[3].innerHTML).toBe("Unnamed plant 1");
        expect(titles[4].innerHTML).toBe("Unnamed plant 2");

        // Click the Species option in sort dropdown again (reverse direction)
        await user.click(component.getByText('Species'));

        // Confirm cards sorted reverse alphabetically, plants without species are first
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 1");
        expect(titles[1].innerHTML).toBe("Unnamed plant 2");
        expect(titles[2].innerHTML).toBe("mini palm tree");
        expect(titles[3].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[4].innerHTML).toBe("Favorite plant");
    });

    it('sorts null to top of list when selected key is last_watered', async () => {
        // Click the Watered option in sort dropdown
        await user.click(component.getByText('Watered'));

        // Confirm "Never watered" is sorted to top followed by least-recently
        // watered (not to the bottom with most-recently watered)
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[1].innerHTML).toBe("Favorite plant");
        expect(titles[2].innerHTML).toBe("mini palm tree");
        expect(titles[3].innerHTML).toBe("Unnamed plant 1");
        expect(titles[4].innerHTML).toBe("Unnamed plant 2");
    });

    it('scrolls top of column into the viewport when filter query changes', async () => {
        // Mock getBoundingClientRect to simulate part of column being scrolled
        // above top of viewport (FilterInput is sticky, stays visible)
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: -50, bottom: 500 }
        );
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Simulate user typing in filter input
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });

        // Confirm page scrolled to prevent whole column going off screen
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('does not scroll when filter query changes if top of column already in viewport', async () => {
        // Mock getBoundingClientRect to simulate entire column being visible
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: 75, bottom: 500 }
        );
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Simulate user typing in filter input
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });

        // Confirm page did NOT scroll (height change cannot push column off
        // screen if top is below the navbar)
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('sorts identical names with numeric suffixes sequentially', async () => {
        // Reduce boilerplate
        const template = {
            name: "",
            display_name: "",
            uuid: "",
            created: "",
            species: "",
            description: "",
            pot_size: "",
            last_watered: "",
            last_fertilized: "",
            thumbnail: ""
        };

        // Render with default sort set to name and 4 plants with identical
        // names other than a numeric suffix
        component = render(
            <FilterColumn
                title="Plants"
                contents={[
                    {
                        ...template,
                        display_name: "Plant 1",
                        uuid: "49a55f1f-5703-4f5e-acad-2c0991a08806"
                    },
                    {
                        ...template,
                        display_name: "Plant 2",
                        uuid: "49a55f1f-5703-4f5e-acad-2c0991a08807"
                    },
                    {
                        ...template,
                        display_name: "Plant 10",
                        uuid: "49a55f1f-5703-4f5e-acad-2c0991a08808"
                    },
                    {
                        ...template,
                        display_name: "Plant 3",
                        uuid: "49a55f1f-5703-4f5e-acad-2c0991a08809"
                    },
                ]}
                CardComponent={PlantCard}
                editing={false}
                formRef={jest.fn()}
                selected={{current: []}}
                ignoreKeys={[]}
                sortByKeys={[
                    {key: 'display_name', display: 'Name'}
                ]}
                defaultSortKey='display_name'
            />
        );

        // Confirm names are sorted sequentially by suffix (10 comes last, not
        // after 1 like it would with pure lexical sort)
        let titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Plant 1");
        expect(titles[1].innerHTML).toBe("Plant 2");
        expect(titles[2].innerHTML).toBe("Plant 3");
        expect(titles[3].innerHTML).toBe("Plant 10");
    });
});

describe('FilterColumn optional parameters', () => {
    // Define default arguments used/overridden in tests below
    let baseArgs;
    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        baseArgs = {
            title: 'Plants',
            contents: plants,
            CardComponent: PlantCard,
            editing: false,
            formRef: jest.fn(),
            selected: {current: []},
            ignoreKeys: [
                'uuid',
                'last_watered',
                'last_fertilized',
                'thumbnail'
            ],
            sortByKeys: [
                {key: 'created', display: 'Added'},
                {key: 'display_name', display: 'Name'},
                {key: 'species', display: 'Species'},
                {key: 'last_watered', display: 'Watered'}
            ],
            defaultSortKey: 'created'
        };
        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('does not render dropdown when sortByKeys arg is empty', async () => {
        // Render without sortByKeys arg
        delete baseArgs.sortByKeys;
        const component = render(
            <FilterColumn { ...baseArgs } />
        );

        // Confirm dropdown button and menu were not rendered
        expect(component.container.querySelector('.dropdown-end')).toBeNull();
        expect(component.queryByTitle('Sort menu')).toBeNull();
    });

    it('matches any key when ignoreKeys arg is empty', async () => {
        // Render without ignoreKeys arg
        delete baseArgs.ignoreKeys;
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <FilterColumn { ...baseArgs } />
        );

        // Type part of UUID, confirm 1 card still present
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, '2c0991a08806');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(1);

        // Type part of timestamp, confirm all cards still present
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(4);
    });

    it('sorts cards by key in defaultSortKey arg by default', () => {
        // Render with defaultSortKey set to display_name
        const args = { ...baseArgs, defaultSortKey: 'display_name' };
        const component = render(
            <FilterColumn  { ...args} />
        );

        // Confirm cards are sorted alphabetically by default
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Favorite plant");
        expect(titles[1].innerHTML).toBe("mini palm tree");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("Unnamed plant 1");
        expect(titles[4].innerHTML).toBe("Unnamed plant 2");
    });

    it('sorts cards in same order as contents array if defaultSortKey arg empty', () => {
        // Render without defaultSortKey arg
        delete baseArgs.defaultSortKey;
        const component = render(
            <FilterColumn { ...baseArgs } />
        );

        // Confirm cards are in same order as contents array
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("mini palm tree");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("Unnamed plant 1");
        expect(titles[3].innerHTML).toBe("Unnamed plant 2");
        expect(titles[4].innerHTML).toBe("Favorite plant");

        // Confirm neither arrow icon is present anywhere in the component
        expect(component.container.querySelector('.fa-arrow-up-long')).toBeNull();
        expect(component.container.querySelector('.fa-arrow-down-long')).toBeNull();
    });

    it('caches sortDirection and sortKey to sessionStorage when changed', async () => {
        // Render with optional storageKey param (persist sort direction and key)
        const args = { ...baseArgs, storageKey: 'unittest' };
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <FilterColumn {...args} />
        );

        // Click the Name option in sort dropdown, click again to reverse direction
        await user.click(component.getByText('Name'));
        await user.click(component.getByText('Name'));

        // Confirm that sortDirection and sortKey were written to sessionStorage
        const persistedState = JSON.parse(sessionStorage.getItem('unittest'));
        expect(persistedState).toEqual({
            sortKey: 'display_name',
            sortDirection: -1,
            query: ''
        });
    });

    it('caches query to sessionStorage when user types in the filter input', async () => {
        // Render with optional storageKey param (persist sort direction and key)
        const args = { ...baseArgs, storageKey: 'unittest' };
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <FilterColumn {...args} />
        );

        // Type "plant" in filter input, wait for rerender (debounced)
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(3);

        // Confirm that query was written to sessionStorage
        let persistedState = JSON.parse(sessionStorage.getItem('unittest'));
        expect(persistedState).toEqual({
            sortKey: 'created',
            sortDirection: 1,
            query: 'plant'
        });

        // Clear input, confirm query was updated in sessionStorage
        await user.clear(filterInput);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });
        expect(component.container.querySelectorAll('.card').length).toBe(5);
        persistedState = JSON.parse(sessionStorage.getItem('unittest'));
        expect(persistedState).toEqual({
            sortKey: 'created',
            sortDirection: 1,
            query: ''
        });
    });

    it('restores sortDirection and sortKey from sessionStorage if set', () => {
        // Simulate object created when user sorts by name + reverses direction
        sessionStorage.setItem('unittest', JSON.stringify({
            sortKey: 'display_name',
            sortDirection: -1,
            query: ''
        }));

        // Render with storageKey param set to key created above
        const args = { ...baseArgs, storageKey: 'unittest' };
        const component = render(
            <FilterColumn {...args} />
        );

        // Confirm cards were sorted reverse alphabetically by name
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 2");
        expect(titles[1].innerHTML).toBe("Unnamed plant 1");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("mini palm tree");
        expect(titles[4].innerHTML).toBe("Favorite plant");
    });
});
