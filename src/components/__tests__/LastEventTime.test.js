import LastEventTime from '../LastEventTime';

describe('LastEventTime', () => {
    it('displays "Never watered" when timestamp is null', () => {
        const { getByText } = render(
            <LastEventTime text="Watered" timestamp={null} />
        );
        expect(getByText('Never watered')).toBeInTheDocument();
    });

    it('displays relative time in seconds when timestamp is today', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp={"2024-03-01T14:00:00.000Z"} />
        );
        expect(getByText('Watered 6 hours ago')).toBeInTheDocument();
    })

    it('displays relative time in days when timestamp is not today', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp={"2024-02-27T00:00:00.000Z"} />
        );
        expect(getByText('Watered 4 days ago')).toBeInTheDocument();
    });
});
