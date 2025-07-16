import React from 'react';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import GroupModal, { openGroupModal } from '../GroupModal';
import { ReduxProvider } from '../store';
import { mockContext, mockGroupOptions } from './mockContext';
import { waitFor } from '@testing-library/react';

describe('GroupModal', () => {
    beforeAll(() => {
        // Create mock state objects (used by ReduxProvider)
        bulkCreateMockContext(mockContext);
    });

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('renders card for each object in /get_add_to_group_options response', async () => {
        // Mock fetch to return group options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockGroupOptions })
        }));

        // Render modal
        const component = render(
            <ReduxProvider>
                <GroupModal />
            </ReduxProvider>
        );

        // Open modal, confirm options requested
        await act(async () => {
            openGroupModal();
        });
        await jest.advanceTimersByTimeAsync(0);
        expect(global.fetch).toHaveBeenCalledWith('/get_add_to_group_options');

        // Confirm contains 2 group options, does not contain "No groups" text
        await waitFor(() => {
            expect(component.getByText('Test group')).not.toBeNull();
            expect(component.getByText('Testing')).not.toBeNull();
            expect(component.queryByText('No groups')).toBeNull();
        });
    });

    it('renders "No groups" if /get_add_to_group_options response is empty', async () => {
        // Mock fetch to return empty group options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: {} })
        }));

        // Render modal
        const component = render(
            <ReduxProvider>
                <GroupModal />
            </ReduxProvider>
        );
        openGroupModal();

        // Confirm "No groups" text and no options
        await waitFor(() => {
            expect(component.getByText('No groups')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
            expect(component.queryByText('Testing')).toBeNull();
        });
    });

    it('renders "No groups" if error occurs in /get_add_to_group_options request', async () => {
        // Mock fetch to simulate error when group options requested
        global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

        // Render modal
        const component = render(
            <ReduxProvider>
                <GroupModal />
            </ReduxProvider>
        );
        openGroupModal();

        // Confirm "No groups" text and no options
        await waitFor(() => {
            expect(component.getByText('No groups')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
            expect(component.queryByText('Testing')).toBeNull();
        });
    });

    it('shows spinner until options load, clears options when closed', async () => {
        // Mock fetch to return group options (requested when modal opened)
        // Add delay so loading spinner will render (simulate real request)
        global.fetch = jest.fn(() => new Promise(resolve =>
            setTimeout(() => {
                resolve({
                    ok: true,
                    json: () => Promise.resolve({ options: mockGroupOptions })
                });
            }, 5)
        ));

        // Render modal
        const component = render(
            <ReduxProvider>
                <GroupModal />
            </ReduxProvider>
        );
        openGroupModal();

        // Confirm loading spinner rendered, contents did not
        await waitFor(() => {
            expect(document.querySelector('.loading')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
        });

        // Fast forward until response received
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5);
        });

        // Confirm spinner disappeared, contents appeared
        await waitFor(() => {
            expect(document.querySelector('.loading')).toBeNull();
            expect(component.getByText('Test group')).not.toBeNull();
        });

        // Close modal, fast forward through close animation
        let event = new Event("close");
        document.querySelector('dialog').dispatchEvent(event);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(200);
        });

        // Confirm contents disappeared
        expect(component.queryByText('Test group')).toBeNull();
    });
});
