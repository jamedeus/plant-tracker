import React from 'react';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import GroupModal, { openGroupModal } from '../GroupModal';
import { ReduxProvider } from '../store';
import { mockContext, mockGroupOptions } from './mockContext';

describe('GroupModal', () => {
    beforeAll(() => {
        // Create mock state objects (used by ReduxProvider)
        bulkCreateMockContext(mockContext);
    });

    it('renders card for each object in group_options response', async () => {
        // Mock fetch to return group options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockGroupOptions })
        }));

        // Render modal, open modal
        const component = render(
            <ReduxProvider>
                <GroupModal />
            </ReduxProvider>
        );
        openGroupModal();

        // Confirm contains 2 group options, does not contain "No groups" text
        await waitFor(() => {
            expect(component.getByText('Test group')).not.toBeNull();
            expect(component.getByText('Testing')).not.toBeNull();
            expect(component.queryByText('No groups')).toBeNull();
        });
    });

    it('renders "No groups" if group_options response is empty', async () => {
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
});
