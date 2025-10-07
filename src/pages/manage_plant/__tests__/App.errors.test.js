import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import App from '../App';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockGroupOptions } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

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

    afterEach(() => {
        act(() => jest.runOnlyPendingTimers());
        jest.useRealTimers();
    });

    it('shows error modal if error received while editing details', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to edit plant details"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Open edit modal
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.click(app.getByText("Edit Details"));

        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Click submit button inside edit modal
        const modal = document.body.querySelector(".modal-box");
        await user.click(within(modal).getByText("Edit"));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to edit plant details'
        );
    });

    it('shows error modal if error received while creating event', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to create event"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to create event'
        );
    });

    it('shows error modal if error received while removing from group', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to remove plant from group"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to remove plant from group'
        );
    });

    it('shows error modal if error received while dividing plant', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "Event with same timestamp already exists"}, 409);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user submitting division modal
        await user.click(app.getByText(/Divide plant/));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await user.click(app.getByRole('button', {name: 'OK'}));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Event with same timestamp already exists'
        );
    });

    it('shows error modal if error received while adding to group', async() => {
        // Mock "Remove from group" response (must remove before add button appears)
        mockFetchResponse({
            action: "remove_plant_from_group",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
        });

        // Click "Remove from group" button in details dropdown
        await user.click(app.getByTitle(/Remove plant from group/));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        // Confirm "Add to group" button appeared in details dropdown
        const addButton = app.getByTitle("Add plant to group");
        expect(addButton).not.toBeNull();

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Mock fetch to return group options (requested when modal opened)
        mockFetchResponse({ options: mockGroupOptions });

        // Open AddToGroupModal
        await user.click(addButton);

        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to add plant to group"}, 400);

        // Simulate user clicking group option (nextSibling targets transparent
        // absolute-positioned div with click listener that covers group card)
        await user.click(app.getByLabelText('Go to Test group page').nextSibling);

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to add plant to group'
        );
    });
});
