import LastEventTime from '../LastEventTime';

describe('LastEventTime', () => {
    it('displays "Never watered" when timestamp is null', () => {
        const { getByText } = render(
            <LastEventTime text="Watered" timestamp={null} />
        );
        expect(getByText('Never watered')).toBeInTheDocument();
    });

    it('displays "just now" when timestamp is less than 1 minute ago', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp='2024-03-01T20:00:00.000+00:00' />
        );
        expect(getByText('Watered just now')).toBeInTheDocument();
    });

    it('displays relative time in minutes when timestamp is between 1 and 59 minutes ago', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp='2024-03-01T19:50:00.000+00:00' />
        );
        expect(getByText('Watered 10 minutes ago')).toBeInTheDocument();
    });

    it('displays relative time in hours when timestamp is more than 1 hour ago', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp='2024-03-01T14:00:00.000+00:00' />
        );
        expect(getByText('Watered 6 hours ago')).toBeInTheDocument();
    });

    it('displays relative time in days when timestamp is not today', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp='2024-02-27T00:00:00.000+00:00' />
        );
        expect(getByText('Watered 4 days ago')).toBeInTheDocument();
    });
});
