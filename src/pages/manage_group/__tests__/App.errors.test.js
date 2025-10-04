import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockPlantOptions } from './mockContext';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import { act } from 'react';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('shows error modal if error received while editing details', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to edit group details"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Open edit modal
        await user.click(app.getByRole('button', {name: 'Edit Details'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Click submit button inside edit modal
        const modal = document.body.querySelector(".modal-box");
        await user.click(within(modal).getByText("Edit"));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to edit group details'
        );
    });

    it('shows error modal if error received while bulk add events', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to bulk add events"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Ensure All plants tab active, click Water button
        await user.click(app.getByRole("tab", {name: "All plants"}));
        await user.click(app.getByRole("button", {name: "Water"}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to bulk add events'
        );
    });

    it('shows error modal if error received while adding plants to group', async() => {
        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to add plants to group/)).toBeNull();

        // Mock fetch to return options (requested when modal opened)
        mockFetchResponse({ options: mockPlantOptions });

        // Open AddPlantsModal modal
        await user.click(app.getByTestId("add_plants_option"));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to add plants to group"}, 400);

        // Simulate user selecting first plant in modal and clicking add
        await user.click(app.getByLabelText('Select Another test plant'));
        await user.click(app.getByRole('button', {name: 'Add'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to add plants to group'
        );
    });

    it('shows error modal if error received while removing plants from group', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to remove plants from group"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click Remove plants dropdown option
        await user.click(app.getByTestId("remove_plants_option"));

        // Simulate user selecting first plant and clicking remove
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByRole('button', {name: 'Remove'}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to remove plants from group'
        );
    });
});
