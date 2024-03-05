import { render } from '@testing-library/react';
import { DateTime } from 'src/testUtils/luxonMock';
import LastEventTime from '../LastEventTime';
import '@testing-library/jest-dom'

describe('App', () => {
    it('displays "Never watered" when timestamp is null', () => {
        const { getByText } = render(
            <LastEventTime text="Watered" timestamp={null} />
        );
        expect(getByText('Never watered')).toBeInTheDocument();
    });

    it('displays relative time when timestamp is provided', () => {
        // Mock system time so relative time doesn't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        const { getByText } = render(
            <LastEventTime text="Water" timestamp={"2024-02-27T00:00:00.000Z"} />
        );
        expect(getByText('Watered 3 days ago')).toBeInTheDocument();

        // Reset mock
        jest.useRealTimers();
    });
});
