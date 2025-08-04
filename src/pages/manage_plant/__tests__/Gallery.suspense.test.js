import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
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
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
        });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('closes suspense, cancels opening gallery if suspense close button is clicked', () => {
        // Render layout component
        const layout = render(
            <ReduxProvider>
                <Layout />
            </ReduxProvider>
        );

        // Open gallery, confirm suspense overlay appeared
        act(() => fireEvent.click(layout.getByRole('button', {name: 'Gallery'})));
        expect(document.body.querySelector('.suspense-overlay')).not.toBeNull();

        // Click suspense close button
        const closeBtn = layout.getByLabelText('Close loading overlay');
        act(() => fireEvent.click(closeBtn));

        // Confirm the suspense overlay disappeared
        act(() => jest.advanceTimersByTime(250));
        expect(document.body.querySelector('.suspense-overlay')).toBeNull();
    });
});
