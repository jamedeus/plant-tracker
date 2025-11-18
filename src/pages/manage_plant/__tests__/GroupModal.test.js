import React from 'react';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse, {
    buildFetchMockResponse,
    mockMultipleFetchResponses
} from 'src/testUtils/mockFetchResponse';
import { v4 as mockUuidv4 } from 'uuid';
import GroupModal from '../GroupModal';
import { ErrorModal } from 'src/components/ErrorModal';
import { ReduxProvider } from '../store';
import { mockContext, mockGroupOptions, mockChangeEvent } from './mockContext';
import { waitFor } from '@testing-library/react';
import { postHeaders } from 'src/testUtils/headers';

jest.mock('uuid', () => ({
    v4: jest.fn(),
}));

describe('GroupModal', () => {
    const mockClose = jest.fn();
    const mockSetTitle = jest.fn();

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        act(() => jest.runAllTimers());
        jest.useRealTimers();
        mockSetTitle.mockClear();
    });

    it('renders card for each object in /get_add_to_group_options response', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );

        // Confirm options requested
        await act(async () => await jest.advanceTimersByTimeAsync(0));
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
        mockFetchResponse({ options: {} });

        // Render modal
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );

        // Confirm "No groups" text and no options
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        await waitFor(() => {
            expect(component.getByText('No groups')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
            expect(component.queryByText('Testing')).toBeNull();
        });
    });

    it('renders "No groups" if error occurs in /get_add_to_group_options request', async () => {
        // Mock fetch to simulate error when group options requested
        mockFetchResponse(null, 500);

        // Render modal
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );

        // Confirm "No groups" text and no options
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        await waitFor(() => {
            expect(component.getByText('No groups')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
            expect(component.queryByText('Testing')).toBeNull();
        });
    });

    it('shows spinner until options load', async () => {
        // Mock fetch to return group options (requested when modal opened)
        // Add delay so loading spinner will render (simulate real request)
        global.fetch = jest.fn(() => new Promise(resolve =>
            setTimeout(() => resolve(buildFetchMockResponse({
                options: mockGroupOptions
            })), 5)
        ));

        // Render modal
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );

        // Confirm loading spinner rendered, contents did not
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        await waitFor(() => {
            expect(document.querySelector('.loading')).not.toBeNull();
            expect(component.queryByText('Test group')).toBeNull();
        });

        // Fast forward until response received
        await act(async () => await jest.advanceTimersByTimeAsync(5));

        // Confirm spinner disappeared, contents appeared
        await waitFor(() => {
            expect(document.querySelector('.loading')).toBeNull();
            expect(component.getByText('Test group')).not.toBeNull();
        });
    });

    it('sends the correct payload when existing group option is clicked', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal, fast forward so options load
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );
        await act(async () => await jest.advanceTimersByTimeAsync(0));

        // Mock expected response when plant is added to group
        mockFetchResponse({
            action: "add_plant_to_group",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            change_event: {
                ...mockChangeEvent,
                group_after: {
                    group_name: "Test group",
                    group_uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                }
            }
        });

        // Simulate user clicking group option (nextSibling targets transparent
        // absolute-positioned div with click listener that covers group card)
        await user.click(component.getByLabelText('Go to Test group page').nextSibling);

        // Confirm correct data posted to /add_plant_to_group
        expect(global.fetch).toHaveBeenCalledWith('/add_plant_to_group', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });

    it('shows group registration form if user clicks "Create new group"', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal, fast forward so options load
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );
        await act(async () => await jest.advanceTimersByTimeAsync(0));

        // Confirm title is "Add plant to group", options are visible
        await waitFor(() => {
            expect(component.getByText('Test group')).not.toBeNull();
            expect(mockSetTitle).toHaveBeenCalledWith('Add plant to group');
        });

        // Simulate user clicking "Create new group" button
        await user.click(component.getByText('Create new group'));

        // Confirm title changed to "Create new group", form replaced options
        await waitFor(() => {
            expect(component.queryByText('Test group')).toBeNull();
            expect(mockSetTitle).toHaveBeenCalledWith('Create new group');
        });

        // Click Cancel button, confirm switches back to options
        await user.click(component.getByRole('button', {name: 'Cancel'}));
        await waitFor(() => {
            expect(component.getByText('Test group')).not.toBeNull();
            expect(mockSetTitle).toHaveBeenCalledWith('Add plant to group');
        });
    });

    it('sends correct payload when group registration form submitted', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal, fast forward so options load
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
            </ReduxProvider>
        );
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        // Mock uuidv4 to return a predictable value for new group
        mockUuidv4.mockReturnValue('0640ec3b-1bed-4b15-a078-d6e7ec66be14');

        // Simulate user clicking "Create new group" button
        await user.click(component.getByText('Create new group'));

        // Simulate user filling in form fields
        await user.type(component.getByRole('textbox', {name: 'Group name'}), 'Test group');
        await user.type(component.getByRole('textbox', {name: 'Group location'}), 'Middle shelf');
        await user.type(component.getByRole('textbox', {name: 'Description'}), 'Microgreens');

        // Mock fetch function to return /register_group response on first
        // request, /add_plant_to_group response on second
        mockMultipleFetchResponses([
            [{
                success: 'group registered',
                name: 'Test group',
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be14'
            }],
            [{
                action: "add_plant_to_group",
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                change_event: {
                    ...mockChangeEvent,
                    group_after: {
                        group_name: "Test group",
                        group_uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
                    }
                }
            }]
        ]);
        global.fetch.mockClear();

        // Simulate user submitting form
        await user.click(component.getByRole('button', {name: 'Create'}));

        // Confirm correct data posted to /register_group endpoint
        expect(global.fetch).toHaveBeenNthCalledWith(1, '/register_group', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                name: "Test group",
                location: "Middle shelf",
                description: "Microgreens",
            }),
            headers: postHeaders
        });

        // Confirm correct data posted to /add_plant_to_group endpoint
        expect(global.fetch).toHaveBeenNthCalledWith(2, '/add_plant_to_group', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if error received while creating new group', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal, fast forward so options load
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
                <ErrorModal />
            </ReduxProvider>
        );
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        // Mock uuidv4 to return a predictable value for new group
        mockUuidv4.mockReturnValue('0640ec3b-1bed-4b15-a078-d6e7ec66be14');

        // Simulate user clicking "Create new group" button
        await user.click(component.getByText('Create new group'));

        // Mock response to simulate error in /register_group call
        mockFetchResponse({error: "uuid already exists in database"}, 409);
        global.fetch.mockClear();

        // Confirm error modal is not rendered
        expect(component.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user submitting form
        await user.click(component.getByRole('button', {name: 'Create'}));

        // Confirm error modal appeared with error text
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(component.getByTestId('error-modal-body')).toHaveTextContent(
            'uuid already exists in database'
        );

        // Confirm only made 1 fetch call (skipped /add_plant_to_group)
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('shows error modal if error received while adding plant to new group', async () => {
        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Render modal, fast forward so options load
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ReduxProvider initialState={mockContext}>
                <GroupModal close={mockClose} setTitle={mockSetTitle} />
                <ErrorModal />
            </ReduxProvider>
        );
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        // Mock uuidv4 to return a predictable value for new group
        mockUuidv4.mockReturnValue('0640ec3b-1bed-4b15-a078-d6e7ec66be14');

        // Simulate user clicking "Create new group" button
        await user.click(component.getByText('Create new group'));

        // Mock fetch function to return /register_group response on first
        // request, arbitrary /add_plant_to_group error on second
        mockMultipleFetchResponses([
            [{
                success: 'group registered',
                name: 'Test group',
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be14'
            }],
            [{ error: "failed to add plant to group" }, 400 ]
        ]);
        global.fetch.mockClear();

        // Confirm error modal is not rendered
        expect(component.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user submitting form
        await user.click(component.getByRole('button', {name: 'Create'}));

        // Confirm error modal appeared with arbitrary error text
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(component.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to add plant to group'
        );

        // Confirm made both requests (/register_group and /add_plant_to_group)
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
