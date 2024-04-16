import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import PlantCard from '../PlantCard';
import '@testing-library/jest-dom';

describe('PlantCard with water event', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={"2024-02-27T05:45:44+00:00"}
                thumbnail={"/media/thumbnails/photo1_thumb.jpg"}
            />
        );
        user = userEvent.setup();
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Plant').nodeName).toBe('H2');
        expect(component.getByText('3 days ago')).toBeInTheDocument();
        expect(component.queryByText('Calathea')).toBeInTheDocument();
        expect(component.queryByText('Mother plant')).toBeInTheDocument();
    });

    it('flips chevron icon when details collapse is opened', async () => {
        // Confirm that ChevronDownIcon is present, ChevronUpIcon is not
        const icon = component.container.querySelectorAll('svg')[1];
        expect(icon.innerHTML.includes('M4.22')).toBe(true);
        expect(icon.innerHTML.includes('M11.78')).toBe(false);

        // Click button, confirm that icon changes to ChevronUpIcon
        await user.click(component.container.querySelector('.btn-close'));
        const newIcon = component.container.querySelectorAll('svg')[1];
        expect(newIcon.innerHTML.includes('M4.22')).toBe(false);
        expect(newIcon.innerHTML.includes('M11.78')).toBe(true);
    });

    it('redirects to manage plant page when clicked', async () => {
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });

        // Click inside div, confirm redirected to manage page
        await user.click(component.getByText('Test Plant'));
        expect(window.location.href).toBe(
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
        jest.resetAllMocks();
    });

    it('shows water icon and time since the plant was last watered', () => {
        // Confirm that FA droplet icon is present
        expect(component.container.querySelector('.fa-droplet')).toBeInTheDocument();
        expect(component.getByText(/3 days ago/)).toBeInTheDocument();
    });
});


describe('PlantCard with no water event', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={null}
                thumbnail={"/media/thumbnails/photo1_thumb.jpg"}
            />
        );
        user = userEvent.setup();
    });

    it('says "never watered" with no icon if plant was never watered', () => {
        // Confirm icon and relative time are not present
        expect(component.container.querySelector('.fa-droplet')).toBeNull();
        expect(component.queryByText(/3 days ago/)).toBeNull();
        // Confirm "Never watered" is present
        expect(component.getByText(/Never watered/)).toBeInTheDocument();
    });
});
