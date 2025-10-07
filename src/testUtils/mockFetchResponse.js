// Takes JSON repsonse and optional status, mocks global fetch function
const mockFetchResponse = (json, status=200) => {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(json),
    }));
};

export default mockFetchResponse;
