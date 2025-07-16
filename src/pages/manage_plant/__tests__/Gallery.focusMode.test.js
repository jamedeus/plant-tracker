import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';
import { waitFor } from '@testing-library/react';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Gallery Focus Mode', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

        // Mock viewport height (simulate thumbnails inside/outside viewport)
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: 800,
        });
    });

    beforeEach(async () => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );

        // Click gallery dropdown option, confirm gallery appears
        await user.click(app.getByRole('button', {name: 'Gallery'}));
        await waitFor(() =>
            expect(document.body.querySelector('.yarl__root')).not.toBeNull()
        );

        // Simulate all images loading (removes loading classes)
        await act(async () => {
            document.querySelectorAll('img').forEach(img => {
                if (img.classList.contains('yarl__slide_image_loading')) {
                    const loadEvent = new Event('load');
                    img.dispatchEvent(loadEvent);
                }
            });
        });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    const advanceTimers = async (delay) => {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(delay);
        });
    };

    it('toggles focus mode when photo or caption is single clicked', async () => {
        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user single clicking on photo slide
        const photoImage = document.querySelector('.yarl__fullsize > .yarl__slide_image');
        await user.pointer([
            { keys: '[MouseLeft>]', target: photoImage },
            { keys: '[/MouseLeft]', target: photoImage }
        ]);

        // Wait for timer (confirms single click not double click)
        await advanceTimers(300);

        // Confirm focus mode activated
        expect(document.body.querySelector('.yarl__root.focus-mode')).not.toBeNull();

        // Simulate user single clicking again
        await user.pointer([
            { keys: '[MouseLeft>]', target: photoImage },
            { keys: '[/MouseLeft]', target: photoImage }
        ]);
        await advanceTimers(300);

        // Confirm no longer in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user single clicking on caption slide
        const caption = document.querySelector('.yarl__slide_description');
        await user.pointer([
            { keys: '[MouseLeft>]', target: caption },
            { keys: '[/MouseLeft]', target: caption }
        ]);
        await advanceTimers(300);

        // Confirm focus mode activated
        expect(document.body.querySelector('.yarl__root.focus-mode')).not.toBeNull();
    });

    it('does not activate focus mode when photo is double clicked', async () => {
        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user double clicking on photo slide
        const photoImage = document.querySelector('.yarl__fullsize > .yarl__slide_image');
        await user.pointer([
            { keys: '[MouseLeft>]', target: photoImage },
            { keys: '[/MouseLeft]', target: photoImage }
        ]);
        await advanceTimers(15);
        await user.pointer([
            { keys: '[MouseLeft>]', target: photoImage },
            { keys: '[/MouseLeft]', target: photoImage }
        ]);

        // Wait for timer (would enter focus mode after 300ms if only 1 click)
        await advanceTimers(300);

        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();
    });

    it('does not activate focus mode when thumbnail is clicked', async () => {
        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user single clicking on thumbnail slide
        const thumbnail = document.querySelector('.yarl__thumbnails_thumbnail');
        await user.pointer([
            { keys: '[MouseLeft>]', target: thumbnail },
            { keys: '[/MouseLeft]', target: thumbnail }
        ]);
        await advanceTimers(300);

        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();
    });

    it('does not activate focus mode when slide is changed by swiping', async () => {
        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user swiping to change photo slide
        const photoImage = document.querySelector('.yarl__fullsize > .yarl__slide_image');
        await user.pointer([
            { keys: '[MouseLeft>]', target: photoImage }
        ]);
        // Move pointer (simulate swipe)
        const moveEvent = new MouseEvent('pointermove', {
            clientX: 200,
            clientY: 300,
            buttons: 1,
            bubbles: true
        });
        document.dispatchEvent(moveEvent);
        await user.pointer([
            { keys: '[/MouseLeft]', target: photoImage }
        ]);

        // Wait for timer (confirms single click not double click)
        await advanceTimers(300);

        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();
    });

    it('does not activate focus mode when buttons are pressed', async () => {
        // Confirm not in focus mode
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user clicking next slide button, confirm not in focus mode
        const nextButton = app.getByRole('button', {name: 'Next photo'});
        await user.click(nextButton);
        await advanceTimers(300);
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user clicking previous slide button, confirm not in focus mode
        const prevButton = app.getByRole('button', {name: 'Previous photo'});
        await user.click(prevButton);
        await advanceTimers(300);
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user clicking fullscreen button, confirm not in focus mode
        const fullscreenButton = app.getByRole('button', {name: 'Enter Fullscreen'});
        await user.click(fullscreenButton);
        await advanceTimers(300);
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();

        // Simulate user clicking dropdown button, confirm not in focus mode
        const dropdownButton = app.getByLabelText('Gallery options');
        await user.click(dropdownButton);
        await advanceTimers(300);
        expect(document.body.querySelector('.yarl__root.focus-mode')).toBeNull();
    });
});
