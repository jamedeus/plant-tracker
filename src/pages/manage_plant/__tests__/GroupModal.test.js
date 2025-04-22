import React from 'react';
import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import GroupModal, { openGroupModal } from '../GroupModal';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('GroupModal', () => {
    beforeAll(() => {
        // Create mock state objects (used by ReduxProvider)
        bulkCreateMockContext(mockContext);
    });

    it('renders card for each object in group_options context', async () => {
        // Create mock group_options with 2 groups
        createMockContext('group_options', mockContext.group_options);

        // Render modal, open modal
        const component = render(
            <PageWrapper>
                <ReduxProvider>
                    <GroupModal />
                </ReduxProvider>
            </PageWrapper>
        );
        openGroupModal();

        // Confirm contains 2 group options, does not contain "No groups" text
        await waitFor(() => {
            expect(component.getByText('Test group')).not.toBeNull();
            expect(component.getByText('Testing')).not.toBeNull();
            expect(component.queryByText('No groups')).toBeNull();
        });
    });

    it('renders "No groups" if group_options context is empty', async () => {
        // Create mock group_options with empty list
        createMockContext('group_options', []);

        // Render modal
        const component = render(
            <PageWrapper>
                <ReduxProvider>
                    <GroupModal />
                </ReduxProvider>
            </PageWrapper>
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
