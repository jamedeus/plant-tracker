import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('Delete mode', () => {
    let app, user;

    beforeAll(() => {
        // Add prune and repot events to mock context
        const mockEvents = {
            ...mockContext.events,
            prune: ["2024-01-01T15:45:44+00:00"],
            repot: ["2024-01-01T15:45:44+00:00"],
        };

        // Create mock state objects (used by ReduxProvider)
        bulkCreateMockContext(mockContext);
        // Override events state with mock containing more events
        createMockContext('events', mockEvents);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    it('shows DeletingEventsFooter when option clicked', async () => {
        // Confirm footer is hidden
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
        // Click dropdown option, confirm footer appeared
        await user.click(app.getByText('Delete mode'));
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-visible");
        // Click cancel button, confirm footer disappeared
        await user.click(app.getByRole('button', {name: 'Cancel'}));
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
    });

    it('sends correct payload when events are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: {
                    water: ["2024-03-01T15:45:44+00:00"],
                    fertilize: ["2024-03-01T15:45:44+00:00"],
                    prune: ["2024-01-01T15:45:44+00:00"],
                    repot: ["2024-01-01T15:45:44+00:00"]
                },
                failed: []
            })
        }));

        // Start selecting events
        await user.click(app.getByText('Delete mode'));

        // Select newest water event
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );

        // Click second newest water event twice (un-select), should not be in payload
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );

        // Select newest fertilize, prune, and repot events
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Fertilized")
        );
        await user.click(
            within(app.getByTestId("2024-01-01-events")).getByText("Pruned")
        );
        await user.click(
            within(app.getByTestId("2024-01-01-events")).getByText("Repoted")
        );

        // Click delete button
        await user.click(app.getByRole('button', {name: 'Delete'}));

        // Confirm correct data posted to /bulk_delete_plant_events endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                events: {
                    water: ["2024-03-01T15:45:44+00:00"],
                    fertilize: ["2024-03-01T15:45:44+00:00"],
                    prune: ["2024-01-01T15:45:44+00:00"],
                    repot: ["2024-01-01T15:45:44+00:00"]
                }
            }),
            headers: postHeaders
        });
    });

    it('clears selection when cancel button clicked', async () => {
        // Start selecting events, select newest water event
        await user.click(app.getByText('Delete mode'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );

        // Click cancel button (hide footer)
        await user.click(app.getByRole('button', {name: 'Cancel'}));

        // Start selecting again, select second newest water event
        await user.click(app.getByText('Delete mode'));
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: {
                    water: ["2024-02-29T10:20:15+00:00"],
                    fertilize: [],
                    prune: [],
                    repot: []
                },
                failed: []
            })
        }));

        // Click delete button, confirm only second newest event (selected in
        // current session) posted (confirms first session selection was cleared)
        await user.click(app.getByRole('button', {name: 'Delete'}));
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                events: {
                    water: ["2024-02-29T10:20:15+00:00"],
                    fertilize: [],
                    prune: [],
                    repot: []
                }
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if error received while deleting event', async () => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to delete event"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to delete event/)).toBeNull();

        // Simulate user deleting newest water event
        await user.click(app.getByText('Delete mode'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await user.click(app.getByRole('button', {name: 'Delete'}));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to delete event/)).not.toBeNull();
    });
});
