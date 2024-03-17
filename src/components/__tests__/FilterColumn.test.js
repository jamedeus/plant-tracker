import { render } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import PlantCard from '../PlantCard';
import FilterColumn from '../FilterColumn';
import '@testing-library/jest-dom';

const plants = [
    {
        "name": "Mini palm tree",
        "uuid": "49a55f1f-5703-4f5e-acad-2c0991a08806",
        "species": "Parlor Palm",
        "description": "Palms aren't really trees",
        "pot_size": 6,
        "last_watered": "2024-03-01T05:45:44+00:00"
    },
    {
        "name": "Unnamed Fittonia",
        "uuid": "6e8b3664-9b5a-4bc9-a62f-50f89a4c3aaf",
        "species": "Fittonia",
        "description": null,
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00"
    },
    {
        "name": "Unnamed plant 1",
        "uuid": "645f3149-dd59-4419-b9a2-d8c796fa29e1",
        "species": null,
        "description": null,
        "pot_size": 8,
        "last_watered": "2024-03-01T05:45:44+00:00"
    },
    {
        "name": "Favorite plant",
        "uuid": "9c9d1767-a97f-4ca8-ad6e-b706ff943ff2",
        "species": "Calathea",
        "description": null,
        "pot_size": 14,
        "last_watered": "2024-03-01T05:13:48+00:00"
    }
];

describe('App', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <FilterColumn
                title="Plants"
                contents={plants}
                cardComponent={PlantCard}
                editing={false}
                selected={[]}
                openRef={{current: true}}
            />
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('renders a card for each item in contents', () => {
        expect(component.container.querySelectorAll('.card').length).toBe(4);
    });

    it('filters visible cards when user types in the filter input', async () => {
        // Type "plant", should only show "Unnamed plant 1" and "Favorite plant"
        const filterInput = component.getByRole('textbox');
        await userEvent.type(filterInput, 'plant');
        expect(component.container.querySelectorAll('.card').length).toBe(2);
        expect(component.getByText('Unnamed plant 1')).toBeInTheDocument();
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "calathea", should only show "Favorite plant" (matches species)
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, 'calathea');
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Favorite plant')).toBeInTheDocument();

        // Type "6", should only show "Mini palm tree" (matches 6 inch pot)
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, '6');
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Mini palm tree')).toBeInTheDocument();

        // Type "really", should only show "Mini palm tree" (matches description)
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, 'really');
        expect(component.container.querySelectorAll('.card').length).toBe(1);
        expect(component.getByText('Mini palm tree')).toBeInTheDocument();
    });

    it('does not match UUIDs or timestamps when filtering', async () => {
        // Type part of UUID, should remove all cards
        const filterInput = component.getByRole('textbox');
        await userEvent.type(filterInput, '2c0991a08806');
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Type part of timsetamp, should remove all cards
        await userEvent.clear(filterInput);
        await userEvent.type(filterInput, '2024-03-01');
        expect(component.container.querySelectorAll('.card').length).toBe(0);
    });

    it('clears the filter input when X button is clcked', async () => {
        // Type random characters in field, confirm no cards visible
        const filterInput = component.getByRole('textbox');
        await userEvent.type(filterInput, 'ffduiwafh');
        expect(component.container.querySelectorAll('.card').length).toBe(0);

        // Click clear button, confirm all 4 cards reappear
        await user.click(component.getByRole('button'));
        expect(component.container.querySelectorAll('.card').length).toBe(4);
    });
});
