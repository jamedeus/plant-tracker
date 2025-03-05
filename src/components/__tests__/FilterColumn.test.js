import PlantCard from '../PlantCard';
import FilterColumn from '../FilterColumn';

const plants = [
    {
        "name": "mini palm tree",
        "display_name": "mini palm tree",
        "uuid": "49a55f1f-5703-4f5e-acad-2c0991a08806",
        "created": "2023-12-20T01:25:12+00:00",
        "species": "Parlor Palm",
        "description": "Palms aren't really trees",
        "pot_size": 6,
        "last_watered": "2024-02-26T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "thumbnail": "/media/thumbnails/IMG_8000_thumb.jpg"
    },
    {
        "name": null,
        "display_name": "Unnamed Fittonia",
        "uuid": "6e8b3664-9b5a-4bc9-a62f-50f89a4c3aaf",
        "created": "2023-12-22T01:25:12+00:00",
        "species": "Fittonia",
        "description": null,
        "pot_size": 4,
        "last_watered": null,
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "thumbnail": "/media/thumbnails/IMG_8001_thumb.jpg"
    },
    {
        "name": null,
        "display_name": "Unnamed plant 1",
        "uuid": "645f3149-dd59-4419-b9a2-d8c796fa29e1",
        "created": "2023-12-24T01:25:12+00:00",
        "species": null,
        "description": null,
        "pot_size": 8,
        "last_watered": "2024-02-28T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "thumbnail": "/media/thumbnails/IMG_8002_thumb.jpg"
    },
    {
        "name": "Favorite plant",
        "display_name": "Favorite plant",
        "uuid": "9c9d1767-a97f-4ca8-ad6e-b706ff943ff2",
        "created": "2023-12-26T01:25:12+00:00",
        "species": "Calathea",
        "description": null,
        "pot_size": 14,
        "last_watered": null,
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "thumbnail": "/media/thumbnails/IMG_8003_thumb.jpg"
    }
];

describe('FilterColumn', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <FilterColumn
                title="Plants"
                contents={plants}
                CardComponent={PlantCard}
                editing={false}
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

    it('renders expected default state', () => {
        // Confirm a card was rendered for each item in contents array
        expect(component.container.querySelectorAll('.card').length).toBe(4);

        // Confirm the sort dropdown contains the options set in sortByKeys arg
        const menu = component.container.querySelector('.dropdown-content');
        expect(menu.children[0].children[0].innerHTML).toContain('Added');
        expect(menu.children[1].children[0].innerHTML).toBe('Name');
        expect(menu.children[2].children[0].innerHTML).toBe('Species');
        expect(menu.children[3].children[0].innerHTML).toBe('Watered');

        // Confirm there is a down arrow icon next to the default option
        expect(menu.children[0].children[0].innerHTML).toContain('svg');
        expect(menu.children[0].children[0].innerHTML).toContain('fa-arrow-down-long');
    });

    it('filters visible cards when user types in the filter input', async () => {
        // Type "plant", should only show "Unnamed plant 1" and "Favorite plant"
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(2);
            expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
            expect(component.getByText('Favorite plant')).toBeInTheDocument();
        });

        // Type "calathea", should only show "Favorite plant" (matches species)
        await user.clear(filterInput);
        await user.type(filterInput, 'calathea');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(1);
            expect(component.getByText('Favorite plant')).toBeInTheDocument();
        });

        // Type "6", should only show "mini palm tree" (matches 6 inch pot)
        await user.clear(filterInput);
        await user.type(filterInput, '6');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(1);
            expect(component.getByText('mini palm tree')).toBeInTheDocument();
        });

        // Type "really", should only show "mini palm tree" (matches description)
        await user.clear(filterInput);
        await user.type(filterInput, 'really');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(1);
            expect(component.getByText('mini palm tree')).toBeInTheDocument();
        });
    });

    it('does not match the keys in ignoreKeys arg when filtering', async () => {
        // Type part of UUID, should remove all cards
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, '2c0991a08806');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of timestamp, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(0);
        });

        // Type part of thumbnail URL, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, 'IMG_8');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(0);
        });
    });

    it('clears the filter input when X button is clcked', async () => {
        // Type random characters in field, confirm no cards visible
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'ffduiwafh');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(0);
        });

        // Click clear button, confirm all 4 cards reappear
        await user.click(component.getAllByRole('button')[0]);
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(4);
        });
    });

    it('sorts cards correctly when sort dropdown option is clicked', async () => {
        // Get array of card titles, confirm expected default order
        let titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("mini palm tree");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("Unnamed plant 1");
        expect(titles[3].innerHTML).toBe("Favorite plant");

        // Click the Name option in sort dropdown
        await user.click(component.getByText('Name'));

        // Confirm cards were sorted alphabetically by name (case insensitive)
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Favorite plant");
        expect(titles[1].innerHTML).toBe("mini palm tree");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("Unnamed plant 1");

        // Confirm a down arrow icon appeared next to name
        let nameOption = component.getByText('Name').parentElement;
        expect(nameOption.querySelector('.fa-arrow-down-long')).not.toBeNull();

        // Click the Name option again to reverse sort order
        await user.click(component.getByText('Name'));

        // Confirm cards were sorted reverse alphabetically by name
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 1");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("mini palm tree");
        expect(titles[3].innerHTML).toBe("Favorite plant");

        // Confirm the down arrow was replaced by an up arrow
        nameOption = component.getByText('Name').parentElement;
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

        // Click the Watered option in sort dropdown
        await user.click(component.getByText('Watered'));

        // Confirm cards sorted alphabetically, plants without last_watered are last
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("mini palm tree");
        expect(titles[1].innerHTML).toBe("Unnamed plant 1");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("Favorite plant");
    });
});

describe('FilterColumn  ', () => {
    // Define default arguments used/overridden in tests below
    let baseArgs;
    beforeEach(() => {
        baseArgs = {
            title: 'Plants',
            contents: plants,
            CardComponent: PlantCard,
            editing: false,
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

    it('does not render dropdown when sortByKeys arg is empty', async () => {
        // Render without sortByKeys arg
        delete baseArgs.sortByKeys;
        const component = render(
            <FilterColumn { ...baseArgs } />
        );

        // Confirm dropdown button and menu were not rendered
        expect(component.container.querySelector('.dropdown')).toBeNull();
        expect(component.container.querySelector('.btn-square')).toBeNull();
    });

    it('matches any key when ignoreKeys arg is empty', async () => {
        // Render without ignoreKeys arg
        delete baseArgs.ignoreKeys;
        const user = userEvent.setup();
        const component = render(
            <FilterColumn { ...baseArgs } />
        );

        // Type part of UUID, confirm 1 card still present
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, '2c0991a08806');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(1);
        });

        // Type part of timestamp, confirm all cards still present
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(4);
        });
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
        expect(titles[3].innerHTML).toBe("Favorite plant");

        // Confirm neither arrow icon is present anywhere in the component
        expect(component.container.querySelector('.fa-arrow-up-long')).toBeNull();
        expect(component.container.querySelector('.fa-arrow-down-long')).toBeNull();
    });

    it('caches sortDirection and sortKey to sessionStorage when changed', async () => {
        // Render with optional storageKey param (persist sort direction and key)
        const args = { ...baseArgs, storageKey: 'unittest' };
        const user = userEvent.setup();
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
            sortDirection: false,
            query: ''
        });
    });

    it('caches query to sessionStorage when user types in the filter input', async () => {
        // Render with optional storageKey param (persist sort direction and key)
        const args = { ...baseArgs, storageKey: 'unittest' };
        const user = userEvent.setup();
        const component = render(
            <FilterColumn {...args} />
        );

        // Type "plant" in filter input, wait for rerender (debounced)
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(2);
        });

        // Confirm that query was written to sessionStorage
        let persistedState = JSON.parse(sessionStorage.getItem('unittest'));
        expect(persistedState).toEqual({
            sortKey: 'created',
            sortDirection: true,
            query: 'plant'
        });

        // Clear input, confirm query was updated in sessionStorage
        await user.clear(filterInput);
        await waitFor(() => {
            expect(component.container.querySelectorAll('.card').length).toBe(4);
        });
        persistedState = JSON.parse(sessionStorage.getItem('unittest'));
        expect(persistedState).toEqual({
            sortKey: 'created',
            sortDirection: true,
            query: ''
        });

    });

    it('restores sortDirection and sortKey from sessionStorage if set', () => {
        // Simulate object created when user sorts by name + reverses direction
        sessionStorage.setItem('unittest', JSON.stringify({
            sortKey: 'display_name',
            sortDirection: false,
            query: ''
        }));

        // Render with storageKey param set to key created above
        const args = { ...baseArgs, storageKey: 'unittest' };
        const component = render(
            <FilterColumn {...args} />
        );

        // Confirm cards were sorted reverse alphabetically by name
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 1");
        expect(titles[1].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[2].innerHTML).toBe("mini palm tree");
        expect(titles[3].innerHTML).toBe("Favorite plant");
    });
});
