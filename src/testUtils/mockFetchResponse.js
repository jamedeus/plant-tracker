// Takes JSON response and optional status, returns value to mock fetch function
const buildMockResponse = (json, status=200) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', 'application/json']]),
    json: () => Promise.resolve(json),
});

// Takes JSON response and optional status, mocks global fetch function
const mockFetchResponse = (json, status=200) => {
    global.fetch = jest.fn().mockResolvedValue(
        buildMockResponse(json, status)
    );
};

// Takes array of arrays each representing 1 fetch response
// Array must contain JSON as first item, optional status as second item
// Mocks global fetch function to return all responses sequentially
export const mockMultipleFetchResponses = (responses) => {
    global.fetch = jest.fn();
    responses.forEach(([ json, status=200 ]) => {
        global.fetch.mockResolvedValueOnce(
            buildMockResponse(json, status)
        );
    });
};

export default mockFetchResponse;
