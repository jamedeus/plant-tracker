import { timestampToDateString } from 'src/utils/timestampUtils';
import mockCurrentURL from './mockCurrentURL';

// Mocks a fetch response for /get_manage_state/<uuid>.
// Updates window.location so components relying on window.location (outside
// react-router) see the new path and optional scrollToDate query param.
const mockManagePlantFetch = (state) => {
    const uuid = state?.plant_details?.uuid;

    global.fetch = jest.fn(() => {
        if (uuid) {
            let path = `/manage/${uuid}`;
            const scrollDate = state?.divided_from?.timestamp
                ? timestampToDateString(state.divided_from.timestamp)
                : null;
            if (scrollDate) {
                path += `?scrollToDate=${scrollDate}`;
            }
            mockCurrentURL(`https://plants.lan${path}`);
        }

        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                page: 'manage_plant',
                title: 'Manage Plant',
                state
            }),
            headers: new Map([['content-type', 'application/json']]),
        });
    });
};

export default mockManagePlantFetch;
