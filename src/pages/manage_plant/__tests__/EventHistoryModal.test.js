import { postHeaders } from 'src/testUtils/headers';
import EventHistoryModal, { openEventHistoryModal } from '../EventHistoryModal';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

/* eslint react/prop-types: 0 */
const TestComponent = ({ context }) => {
    // Add prune and repot events to mock context
    const state = {
        ...context,
        events: {
            ...context.events,
            prune: ["2024-01-01T15:45:44+00:00"],
            repot: ["2024-01-01T15:45:44+00:00"],
        }
    };

    // Render app
    return (
        <>
            <EventHistoryModal
                plantID={context.plant_details.uuid}
                events={state.events}
                removeEvent={jest.fn()}
            />
            <button onClick={openEventHistoryModal}>
                Open event history modal
            </button>
        </>
    );
};

describe('EventHistoryModal', () => {
    let component, user;

    beforeEach(async () => {
        // Deep copy context to prevent changes carrying over to next test
        const context = JSON.parse(JSON.stringify(mockContext));

        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <PageWrapper>
                <TestComponent context={context} />
            </PageWrapper>
        );

        // Open modal
        await user.click(component.getByText('Open event history modal'));
    });

    it('opens modal when openDeletePhotosModal called', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(component.getByText('Open event history modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('disables delete button until at least one event selected', async() => {
        // Delete button should be disabled
        expect(component.getByText('Delete')).toBeDisabled();

        // Select first water event, confirm delete button is enabled
        await user.click(component.getByText(/today/));
        expect(component.getByText('Delete')).not.toBeDisabled();

        // Un-select event, confirm delete button is disabled
        await user.click(component.getByText(/today/));
        expect(component.getByText('Delete')).toBeDisabled();
    });

    it('sends correct payload when events are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": [
                    {"type": "water", "timestamp": "2024-03-01T15:45:44+00:00"},
                    {"type": "fertilize", "timestamp": "2024-03-01T15:45:44+00:00"},
                    {"type": "prune", "timestamp": "2024-01-01T15:45:44+00:00"},
                    {"type": "repot", "timestamp": "2024-01-01T15:45:44+00:00"}
                ],
                "failed": []
            })
        }));

        // Click first event in water column (default)
        await user.click(component.getByText(/today/));

        // Click second water event twice (un-select), should not be in payload
        await user.click(component.getByText(/yesterday/));
        await user.click(component.getByText(/yesterday/));

        // Switch to fertilize column, click first event
        await user.click(component.getByText(/Fertilize/));
        await user.click(component.getByText(/today/));

        // Switch to prune column, click first event
        await user.click(component.getByText(/Prune/));
        await user.click(component.getByText(/60 days ago/));

        // Switch to repot column, click first event
        await user.click(component.getByText(/Repot/));
        await user.click(component.getByText(/60 days ago/));

        // Click delete button
        await user.click(component.getByText('Delete'));

        // Confirm correct data posted to /delete_plant_event endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "events": [
                    {"type": "water", "timestamp": "2024-03-01T15:45:44+00:00"},
                    {"type": "fertilize", "timestamp": "2024-03-01T15:45:44+00:00"},
                    {"type": "prune", "timestamp": "2024-01-01T15:45:44+00:00"},
                    {"type": "repot", "timestamp": "2024-01-01T15:45:44+00:00"}
                ]
            }),
            headers: postHeaders
        });
    });

    it('shows the correct history column when event type selected', async () => {
        // Confirm water event date is visible, fertilize event date is not
        expect(component.queryByText(/February 29/)).not.toBeNull();
        expect(component.queryByText(/February 26/)).toBeNull();

        // Click fertilize button
        await user.click(component.getByText(/Fertilize/));

        // Confirm fertilize event date is visible, water event date is not
        expect(component.queryByText(/February 26/)).not.toBeNull();
        expect(component.queryByText(/February 29/)).toBeNull();

        // Click prune button
        await user.click(component.getByText(/Prune/));

        // Confirm neither date is visible (no prune events in mock context)
        expect(component.queryByText(/February 26/)).toBeNull();
        expect(component.queryByText(/February 29/)).toBeNull();
    });

    it('shows error modal if error received while deleting event', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to delete event"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(component.queryByText(/failed to delete event/)).toBeNull();

        // Simulate user deleting first event in water history
        await user.click(component.getByText(/today/));
        await user.click(component.getByText('Delete'));

        // Confirm modal appeared with arbitrary error text
        expect(component.queryByText(/failed to delete event/)).not.toBeNull();
    });
});
