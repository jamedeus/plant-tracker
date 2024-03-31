// Simulated django context, parsed into state object
export const mockContext = {
    "plant": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "events": {
            "water": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-29T10:20:15+00:00",
            ],
            "fertilize": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-26T02:44:12+00:00",
            ],
            "prune": [],
            "repot": [],
        },
        "tray": {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "trays": [
        {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        },
        {
            "name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61"
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ],
    "photo_urls": [
        {
            'created': '2024:03:21 10:52:03',
            'image': '/media/images/photo1.jpg',
            'thumbnail': '/media/thumbnails/photo1_thumb.jpg',
            'key': 1
        },
        {
            'created': '2024:03:22 10:52:03',
            'image': '/media/images/photo2.jpg',
            'thumbnail': '/media/thumbnails/photo2_thumb.jpg',
            'key': 2
        }
    ]
};

export const mockContextNoEvents = {
    "plant": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "events": {
            "water": [],
            "fertilize": [],
            "prune": [],
            "repot": [],
        },
        "tray": {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "trays": [
        {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        },
        {
            "name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61"
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ],
    "photo_urls": []
};
