import GroupDetails from '../GroupDetails';

describe('GroupDetails', () => {
    it('displays correct details', () => {
        const { getByText, queryByText } = render(
            <GroupDetails
                location='Middle shelf'
                description='Used for propagation'
            />
        );
        expect(getByText('Middle shelf')).toBeInTheDocument();
        expect(getByText('Used for propagation')).toBeInTheDocument();
        expect(queryByText('No details')).toBeNull();
    });

    it('hides location row if argument is null', () => {
        const { getByText } = render(
            <GroupDetails
                location={null}
                description='Used for propagation'
            />
        );
        expect(getByText('Location:').parentElement.classList).toContain('hidden');
        expect(getByText('Description:').parentElement.classList).not.toContain('hidden');
    });

    it('hides description row if argument is null', () => {
        const { getByText } = render(
            <GroupDetails
                location='Middle shelf'
                description={null}
            />
        );
        expect(getByText('Location:').parentElement.classList).not.toContain('hidden');
        expect(getByText('Description:').parentElement.classList).toContain('hidden');
    });

    it('displays "No details" when both arguments are null', () => {
        const { getByText, queryByText } = render(
            <GroupDetails location={null} description={null} />
        );
        expect(getByText('No details')).toBeInTheDocument();
        expect(queryByText('Location')).toBeNull();
    });
});
