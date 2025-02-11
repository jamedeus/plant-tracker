// Simulated django context, parsed into state object
export const mockContext = {
    "plants": [
        {
            "name": "Test Plant",
            "display_name": "Test Plant",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            "created": "2023-12-26T01:25:12+00:00",
            "species": "Calathea",
            "description": "",
            "pot_size": 4,
            "last_watered": "2024-02-26T02:44:12+00:00",
            "last_fertilized": "2024-02-26T02:44:12+00:00",
            "thumbnail": "/media/thumbnails/photo_thumb.jpg",
            "archived": false
        }
    ],
    "groups": [
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            "created": "2023-12-26T01:25:12+00:00",
            "name": "Test group",
            "display_name": "Test group",
            "location": "Middle shelf",
            "plants": 4,
            "archived": false
        }
    ]
};

export const archivedMockContext = {
    "plants": [
        {
            "name": "Test Plant",
            "display_name": "Test Plant",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            "created": "2023-12-26T01:25:12+00:00",
            "species": "Calathea",
            "description": "",
            "pot_size": 4,
            "last_watered": "2024-02-26T02:44:12+00:00",
            "last_fertilized": "2024-02-26T02:44:12+00:00",
            "thumbnail": "/media/thumbnails/photo_thumb.jpg",
            "archived": true
        }
    ],
    "groups": [
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            "created": "2023-12-26T01:25:12+00:00",
            "name": "Test group",
            "display_name": "Test group",
            "location": "Middle shelf",
            "plants": 4,
            "archived": true
        }
    ]
};
