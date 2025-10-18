import React, { act } from 'react';
import { postHeaders } from 'src/testUtils/headers';
import mockFetchResponse, { buildFetchMockResponse } from 'src/testUtils/mockFetchResponse';
import RepotModal from '../RepotModal';
import { ReduxProvider } from '../store';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';
import { changeQrScannerOpened } from '../interfaceSlice';

// Mock useDispatch to return a mock (confirm changeQrScannerOpened called)
const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
    const actual = jest.requireActual('react-redux');
    return {
        ...actual,
        useDispatch: jest.fn(() => (action) => mockDispatch(action))
    };
});

describe('RepotModal', () => {
    let app, user;
    const mockClose = jest.fn();

    beforeEach(async () => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render modal + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <ReduxProvider initialState={mockContext}>
                    <RepotModal close={mockClose} />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        mockDispatch.mockClear();
    });

    it('shows correct modal contents for each step', async () => {
        // Confirm prompt is visible, loading spinner and success screen are not
        expect(app.getByText('When did you repot your plant?')).not.toBeNull();
        expect(app.queryByTestId('repot-modal-loading')).toBeNull();
        expect(app.queryByTestId('repot-modal-success')).toBeNull();

        // Mock fetch function to return expected response after delay (allow
        // loading spinner to render before switching to success screen)
        global.fetch = jest.fn(() => new Promise(resolve =>
            setTimeout(() => resolve(buildFetchMockResponse({
                action: "repot",
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamp: "2024-03-01T20:00:00+00:00",
                pot_size: 8
            })), 5)
        ));

        // Click submit button, confirm prompt was replaced by loading spinner
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));
        await act(async () => await jest.advanceTimersByTimeAsync(1));
        expect(app.queryByText('When did you repot your plant?')).toBeNull();
        expect(app.getByTestId('repot-modal-loading')).not.toBeNull();
        expect(app.queryByTestId('repot-modal-success')).toBeNull();

        // Fast forward until request completes, confirm success screen appeared
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.queryByText('When did you repot your plant?')).toBeNull();
        expect(app.queryByTestId('repot-modal-loading')).toBeNull();
        expect(app.getByTestId('repot-modal-success')).not.toBeNull();
    });

    it('sends correct payload when RepotModal is submitted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "repot",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-03-01T20:00:00+00:00",
            pot_size: 8
        });

        // Select 8 inch pot
        await user.click(app.getByTitle('8 inch pot'));

        // Click submit button
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));

        // Confirm correct data posted to /repot_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                new_pot_size: 8,
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('uses value in custom pot size input when selected', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "repot",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-03-01T20:00:00+00:00",
            pot_size: 5
        });

        // Click custom pot size option, enter "5"
        await user.click(app.getByPlaceholderText('custom'));
        await user.type(app.getByPlaceholderText('custom'), '5');

        // Click submit button
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));

        // Confirm payload includes custom pot size
        expect(global.fetch).toHaveBeenCalledWith('/repot_plant', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                new_pot_size: 5,
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });
    });

    it('does not make /repot_plant request if custom pot size is blank', async () => {
        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click custom pot size option, click submit without entering value
        await user.click(app.getByPlaceholderText('custom'));
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));

        // Confirm error modal appeared with instructions
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Please enter a custom pot size or select a different option'
        );

        // Confirm fetch was NOT called
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('shows error modal if error received while repotting plant', async() => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to repot plant"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user submitting repot modal
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));

        // Confirm modal appeared with arbitrary error text
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to repot plant'
        );
    });

    it('closes modal and opens ChangeQrScanner when Change QR Code button clicked', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            action: "repot",
            plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            timestamp: "2024-03-01T20:00:00+00:00",
            pot_size: 8
        });

        // Click submit button, confirm made request
        await user.click(app.getByRole('button', {name: 'Repot Plant'}));
        expect(global.fetch).toHaveBeenCalled();

        // Click Change QR Code button that appears on success screen
        await user.click(app.getByRole('button', {name: 'Change QR Code'}));

        // Confirm RepotModal closed, ChangeQRScanner opened
        expect(mockClose).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(changeQrScannerOpened(true));
    });

    it('disables next page button if custom pot size selected and input empty', async () => {
        // Confirm next button is not disabled
        expect(app.getByTestId('pot-size-options').getAttribute('data-next-button')).toBeNull();

        // Click custom pot size option, don't fill in input
        await user.click(app.getByPlaceholderText('custom'));

        // Confirm next button is disabled
        expect(app.getByTestId('pot-size-options').getAttribute('data-next-button')).toBe('disabled');
    });
});

describe('RepotModal default size option', () => {
    const renderWithCurrentPotSize = (currentPotSize) => {
        return render(
            <>
                <ReduxProvider initialState={{
                    ...mockContext,
                    plant_details: {
                        ...mockContext.plant_details,
                        pot_size: currentPotSize
                    }
                }}>
                    <RepotModal close={jest.fn()} />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
    };

    it('defaults to 2 inch pot size if currentPotSize not set', async () => {
        // Render RepotModal with no currentPotSize
        const component = renderWithCurrentPotSize(null);
        // Confirm 2 inch pot size is selected by default
        expect(component.getByTitle('2 inch pot').classList).toContain('pot-size-selected');
    });

    it('defaults to next size option if currentPotSize is set', async () => {
        // Render RepotModal with 4 inch currentPotSize
        const component = renderWithCurrentPotSize(4);
        // Confirm 6 inch pot size is selected by default
        expect(component.getByTitle('6 inch pot').classList).toContain('pot-size-selected');
    });

    it('defaults to custom pot size if currentPotSize is largest option', async () => {
        // Render RepotModal with 21 inch currentPotSize
        const component = renderWithCurrentPotSize(21);
        // Confirm 6 inch pot size is selected by default
        expect(component.getByPlaceholderText('custom').classList).toContain('pot-size-selected');
    });
});
