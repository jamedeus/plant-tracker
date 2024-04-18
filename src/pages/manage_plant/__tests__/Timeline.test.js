import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import Timeline from '../Timeline';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockEvents, mockPhotoUrls } from './mockContext';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ErrorModalProvider>
                <Timeline events={mockEvents} photoUrls={mockPhotoUrls} />
            </ErrorModalProvider>
        );
        user = userEvent.setup();
    });

    it('expands quick navigation subsections when user hovers', async () => {
        // Get reference to History title, dropdown menu, and first subsection
        const history = app.getByText(/History/);
        const dropdown = history.parentElement.children[1];
        const yearSection = dropdown.children[0].children[0];

        // Confirm year subsection is closed
        expect(yearSection).toHaveProperty('open', false);

        // Click history and hover over subsection, confirm subsection opens
        await user.click(history);
        await user.hover(yearSection);
        expect(yearSection).toHaveProperty('open', true);

        // Unhover, confirm subsection closes
        await user.unhover(yearSection);
        expect(yearSection).toHaveProperty('open', false);
    });

    it('scrolls to timeline when quick navigation is clicked', async () => {
        // Get reference to History title (contains quick nav dropdown)
        const history = app.getByText(/History/).parentElement;

        // Confirm scrollIntoView has not been called
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

        // Click year and month in history menu
        await user.click(history);
        await user.click(within(history).getByText(/2023/));
        await user.click(within(history).getByText(/December/));

        // Confirm scrollIntoView was called
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
});
