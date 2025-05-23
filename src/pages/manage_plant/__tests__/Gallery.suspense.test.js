import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import Layout from '../Layout';
import { ReduxProvider } from '../store';
import { mockContext } from './mockContext';

// Mock Gallery lazy import to return a component that never loads
jest.mock('../Gallery', () => {
    const KeepSuspenseOpen = () => { throw new Promise(() => {}); };
    return { __esModule: true, default: KeepSuspenseOpen };
});

describe('Gallery suspense overlay', () => {
    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('closes suspense, cancels opening gallery if suspense close button is clicked', async () => {
        // Render layout component
        const layout = render(
            <ReduxProvider>
                <Layout />
            </ReduxProvider>
        );

        // Open gallery, confirm suspense overlay appeared
        fireEvent.click(layout.getByRole('button', {name: 'Gallery'}));
        expect(document.body.querySelector('.suspense-overlay')).not.toBeNull();

        // Click suspense close button
        const closeBtn = layout.getByLabelText('Close loading overlay');
        fireEvent.click(closeBtn);

        // Confirm the suspense overlay disappeared
        jest.advanceTimersByTime(250);
        expect(document.body.querySelector('.suspense-overlay')).toBeNull();
    });
});
