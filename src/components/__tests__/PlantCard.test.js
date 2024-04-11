import { render } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import PlantCard from '../PlantCard';
import '@testing-library/jest-dom';

describe('App', () => {
    let component, user;

    beforeEach(() => {
        // Mock system time so last watered time doesn't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        // Render component + create userEvent instance to use in tests
        component = render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={"2024-02-27T05:45:44+00:00"}
            />
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
        jest.useRealTimers();
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
});
