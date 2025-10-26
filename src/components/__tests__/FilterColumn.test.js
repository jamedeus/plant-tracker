import PlantCard from '../PlantCard';
import FilterColumn from '../FilterColumn';
import { createEditableNodeListController } from '../editableNodeListController';
import { firePointerEvent } from './EditableNodeList.test';

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
        thumbnail: "/media/thumbnails/IMG_8000_thumb.webp",
        archived: false,
        group: null
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
        thumbnail: "/media/thumbnails/IMG_8001_thumb.webp",
        archived: false,
        group: null
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
        thumbnail: "/media/thumbnails/IMG_8002_thumb.webp",
        archived: false,
        group: {
            name: 'Back yard',
            uuid: 'dc569900-2066-488a-b7b0-ce72252756cb'
        }
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
        thumbnail: "/media/thumbnails/IMG_8004_thumb.webp",
        archived: false,
        group: null
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
        thumbnail: "/media/thumbnails/IMG_8003_thumb.webp",
        archived: false,
        group: null
    },
];

describe('FilterColumn', () => {
    let component, user, selectionController;

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render component + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        selectionController = createEditableNodeListController();
        component = render(
            <FilterColumn
                title="Plants"
                contents={plants}
                CardComponent={PlantCard}
                editing={false}
                controller={selectionController}
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
        expect(menu.children[0]).toHaveTextContent('Added');
        expect(menu.children[1]).toHaveTextContent('Name');
        expect(menu.children[2]).toHaveTextContent('Species');
        expect(menu.children[3]).toHaveTextContent('Watered');

        // Confirm there is a down arrow icon next to the default option
        expect(menu.children[0].querySelector('svg')).not.toBeNull();
        expect(menu.children[0].querySelector('svg').classList).toContain('rotate-0');
        // Confirm there is no icon next to the other options
        expect(menu.children[1].querySelector('svg')).toBeNull();
        expect(menu.children[2].querySelector('svg')).toBeNull();
        expect(menu.children[3].querySelector('svg')).toBeNull();
    });

    it('filters visible cards when user types in the filter input', async () => {
        // Type "plant", should only show "Unnamed plant 1", "Unnamed plant 2",
        // and "Favorite plant"
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(3);
        expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
        expect(component.getByText('Unnamed plant 2')).toBeInTheDocument();
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "calathea", should only show "Favorite plant" (matches species)
        await user.clear(filterInput);
        await user.type(filterInput, 'calathea');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "6", should only show "mini palm tree" (matches 6 inch pot)
        await user.clear(filterInput);
        await user.type(filterInput, '6');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('mini palm tree')).toBeInTheDocument();

        // Type "really", should only show "mini palm tree" (matches description)
        await user.clear(filterInput);
        await user.type(filterInput, 'really');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('mini palm tree')).toBeInTheDocument();

        // Type "yard", should only show "Unnamed plant 1" (matches group name)
        await user.clear(filterInput);
        await user.type(filterInput, 'yard');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
    });

    it('does not match the keys in ignoreKeys arg when filtering', async () => {
        // Type part of UUID, should remove all cards
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, '2c0991a08806');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Type part of timestamp, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Type part of thumbnail URL, should remove all cards
        await user.clear(filterInput);
        await user.type(filterInput, 'IMG_8');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(0);
    });

    it('clears the filter input when X button is clcked', async () => {
        // Type random characters in field, confirm no cards visible
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'ffduiwafh');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Click clear button, confirm all 4 cards reappear
        await user.click(component.getByTitle("Clear filter input"));
        await act(async () => await jest.advanceTimersByTimeAsync(200));
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
        expect(nameOption.querySelector('svg')).not.toBeNull();
        expect(nameOption.querySelector('svg').classList).toContain('rotate-0');

        // Click the Name option again to reverse sort order
        await user.click(component.getByText('Name'));

        // Confirm cards were sorted reverse alphabetically by name
        titles = component.container.querySelectorAll('.card-title');
        expect(titles[0].innerHTML).toBe("Unnamed plant 2");
        expect(titles[1].innerHTML).toBe("Unnamed plant 1");
        expect(titles[2].innerHTML).toBe("Unnamed Fittonia");
        expect(titles[3].innerHTML).toBe("mini palm tree");
        expect(titles[4].innerHTML).toBe("Favorite plant");

        // Confirm the down arrow rotated 180 degrees (up arrow)
        nameOption = component.getByText('Name').closest('li');
        expect(nameOption.querySelector('svg').classList).not.toContain('rotate-0');
        expect(nameOption.querySelector('svg').classList).toContain('-rotate-180');
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
        await act(async () => await jest.advanceTimersByTimeAsync(200));

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
        await act(async () => await jest.advanceTimersByTimeAsync(200));

        // Confirm page did NOT scroll (height change cannot push column off
        // screen if top is below the navbar)
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls sort dropdown into view when sort dropdown is opened', async () => {
        // Mock viewport height
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: 800,
        });

        // Mock dropdown inside viewport (should not scroll, already visible)
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: 550, bottom: 650 }
        );

        // Open sort dropdown
        await user.click(component.getByTitle('Sort menu'));

        // Confirm scrollIntoView was not called
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Mock bottom of dropdown outside viewport (should scroll into view)
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
            { top: 750, bottom: 850 }
        );

        // Close sort dropdown, then open again
        document.activeElement.blur();
        await user.click(component.getByTitle('Sort menu'));

        // Confirm scrollIntoView was called
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('sorts identical names with numeric suffixes sequentially', async () => {
        // Reduce boilerplate
        const template = {
            name: "",
            display_name: "",
            uuid: "",
            created: "2023-12-27T03:51:32+00:00",
            species: "",
            description: "",
            pot_size: null,
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
                controller={createEditableNodeListController()}
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
            controller: createEditableNodeListController(),
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
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);

        // Type part of timestamp, confirm all cards still present
        await user.clear(filterInput);
        await user.type(filterInput, '2024-03-01');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
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

        // Confirm arrow icon is not present on any dropdown option
        const options = component.container.querySelector('.dropdown-content');
        expect(options.querySelector('svg')).toBeNull();
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
        await act(async () => await jest.advanceTimersByTimeAsync(200));
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
        await act(async () => await jest.advanceTimersByTimeAsync(200));
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

    it('unselects items that are no longer in list after filtering', async () => {
        // Render with editing = true and controller to check selection
        const controller = createEditableNodeListController();
        const args = { ...baseArgs, editing: true, controller: controller };
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <FilterColumn {...args} />
        );

        // Confirm 5 cards, none selected
        expect(component.container.querySelectorAll('.card').length).toBe(5);
        expect(controller.getSnapshot()).toEqual(new Set());

        // Select "mini palm tree", confirm controller updated selection
        await user.click(component.getByLabelText('Select mini palm tree'));
        expect(controller.getSnapshot()).toEqual(new Set(['49a55f1f-5703-4f5e-acad-2c0991a08806']));

        // Filter to "calathea", should only show "Favorite plant" (species)
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'calathea');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Confirm selection was cleared (mini palm tree no longer in list)
        expect(controller.getSnapshot()).toEqual(new Set());

        // Clear selection, confirm all 5 cards reappear
        await user.clear(filterInput);
        expect(component.container.querySelectorAll('.card').length).toBe(5);

        // Select "Favorite plant", confirm controller updated selection
        await user.click(component.getByLabelText('Select Favorite plant'));
        expect(controller.getSnapshot()).toEqual(new Set(['9c9d1767-a97f-4ca8-ad6e-b706ff943ff2']));

        // Filter to "calathea" again, confirm selection did NOT change (still visible)
        await user.type(filterInput, 'calathea');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(controller.getSnapshot()).toEqual(new Set(['9c9d1767-a97f-4ca8-ad6e-b706ff943ff2']));
    });

    // Original bug: EditableNodeList did not reset shift-click selection state
    // when children changed. When the user selected a node its index was stored
    // (shift-click range start point), but when children changed it did not
    // change even though the order probably did. If the user then shift-clicked
    // after filtering it would select everything from the clicked node to
    // whichever node now had the original index.
    it('clears shift click state when children change', async () => {
        // Render with editing = true and controller to check selection
        const controller = createEditableNodeListController();
        const args = { ...baseArgs, editing: true, controller: controller };
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <FilterColumn {...args} />
        );

        // Confirm 5 cards, none selected
        expect(component.container.querySelectorAll('.card').length).toBe(5);
        expect(controller.getSnapshot()).toEqual(new Set());

        // Select "mini palm tree", confirm controller updated selection
        await user.click(component.getByLabelText('Select mini palm tree'));
        expect(controller.getSnapshot()).toEqual(new Set(['49a55f1f-5703-4f5e-acad-2c0991a08806']));

        // Type "plant", should only show "Unnamed plant 1", "Unnamed plant 2",
        // and "Favorite plant"
        const filterInput = component.getByRole('textbox');
        await user.type(filterInput, 'plant');
        await act(async () => await jest.advanceTimersByTimeAsync(200));
        expect(component.container.querySelectorAll('.card').length).toBe(3);
        expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
        expect(component.getByText('Unnamed plant 2')).toBeInTheDocument();
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Shift-click Favorite plant (last button)
        const lastButton = component.getByLabelText('Select Favorite plant')
        firePointerEvent(lastButton, 'pointerdown', {
            pointerId: 32,
            button: 0,
            clientX: 210,
            clientY: 320,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 32 });

        // Confirm only Favorite plant is selected (did not select range)
        expect(controller.getSnapshot()).toEqual(new Set(['9c9d1767-a97f-4ca8-ad6e-b706ff943ff2']));
    });
});
