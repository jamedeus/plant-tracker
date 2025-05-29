// Simulated django context, parsed into state object
export const mockContext = {
    "plant_details": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "created": "2023-12-26T01:25:12+00:00",
        "archived": false,
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "thumbnail": "/media/thumbnails/photo3_thumb.webp",
        "group": {
            "name": "Test group",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "events": {
        "water": [
            "2024-03-01T15:45:44+00:00",
            "2024-02-29T10:20:15+00:00",
        ],
        "fertilize": [
            "2024-03-01T15:45:44+00:00",
            "2024-02-26T12:44:12+00:00",
        ],
        "prune": [],
        "repot": [],
    },
    "notes": [
        {
            "timestamp": "2024-03-01T15:45:44+00:00",
            "text": "Fertilized with dilute 10-15-10 liquid fertilizer"
        },
        {
            "timestamp": "2024-02-26T12:44:12+00:00",
            "text": "One of the older leaves is starting to turn yellow"
        }
    ],
    "group_options": [
        {
            "name": "Test group",
            "display_name": "Test group",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            "created": "2023-12-26T01:25:12+00:00",
            "location": "Top shelf",
            "description": "Medium brightness grow light",
            "plants": 3,
            "archived": false
        },
        {
            "name": "Testing",
            "display_name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61",
            "created": "2023-12-26T01:25:12+00:00",
            "location": "Middle shelf",
            "description": "Brightest grow light",
            "plants": 5,
            "archived": false
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ],
    "photos": [
        {
            'timestamp': '2024-03-21T10:52:03+00:00',
            'image': '/media/images/photo1.jpg',
            'thumbnail': '/media/thumbnails/photo1_thumb.webp',
            'preview': '/media/previews/photo1_preview.webp',
            'key': 1
        },
        {
            'timestamp': '2024-03-22T10:52:03+00:00',
            'image': '/media/images/photo2.jpg',
            'thumbnail': '/media/thumbnails/photo2_thumb.webp',
            'preview': '/media/previews/photo2_preview.webp',
            'key': 2
        },
        {
            'timestamp': '2024-03-23T10:52:03+00:00',
            'image': '/media/images/photo3.jpg',
            'thumbnail': '/media/thumbnails/photo3_thumb.webp',
            'preview': '/media/previews/photo3_preview.webp',
            'key': 3
        }
    ],
    "default_photo":
    {
        'set': true,
        'timestamp': '2024-03-23T10:52:03+00:00',
        'image': '/media/images/photo3.jpg',
        'thumbnail': '/media/thumbnails/photo3_thumb.webp',
        'preview': '/media/previews/photo3_preview.webp',
        'key': 3
    }
};

export const mockContextNoEvents = {
    "plant_details": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "created": "2023-12-26T01:25:12+00:00",
        "archived": false,
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "thumbnail": null,
        "group": {
            "name": "Test group",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "events": {
        "water": [],
        "fertilize": [],
        "prune": [],
        "repot": [],
    },
    "notes": [],
    "group_options": [
        {
            "name": "Test group",
            "display_name": "Test group",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            "created": "2023-12-26T01:25:12+00:00",
            "location": "Top shelf",
            "description": "Medium brightness grow light",
            "plants": 3,
            "archived": false
        },
        {
            "name": "Testing",
            "display_name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61",
            "created": "2023-12-26T01:25:12+00:00",
            "location": "Middle shelf",
            "description": "Brightest grow light",
            "plants": 5,
            "archived": false
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ],
    "photos": [],
    "default_photo":
    {
        'set': false,
        'timestamp': null,
        'image': null,
        'thumbnail': null,
        'key': null
    }
};

export const mockEvents = {
    "water": [
        "2024-04-17T21:21:41+00:00",
        "2024-04-16T22:19:47+00:00",
        "2024-04-15T22:27:59+00:00",
        "2024-04-14T22:08:58+00:00",
        "2024-04-14T19:02:53+00:00",
        "2024-04-13T22:08:58+00:00",
        "2024-04-12T18:00:52+00:00",
        "2024-04-11T19:04:20+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-25T02:50:21+00:00",
        "2024-03-24T01:51:30+00:00",
        "2024-03-23T05:20:10+00:00",
        "2024-03-22T01:51:30+00:00",
        "2024-03-17T21:21:41+00:00",
        "2024-03-13T07:35:00+00:00",
        "2024-02-17T22:21:41+00:00",
        "2024-01-17T22:21:41+00:00",
        "2023-12-17T22:21:41+00:00",
        "2023-11-23T01:38:19+00:00",
        "2023-11-22T01:38:19+00:00",
        "2023-11-21T01:38:19+00:00",
        "2023-11-17T22:21:41+00:00",
        "2023-10-17T21:21:41+00:00",
        "2023-09-17T21:21:41+00:00",
        "2023-08-17T21:21:41+00:00",
        "2023-07-17T21:21:41+00:00",
        "2023-06-17T21:21:41+00:00",
        "2023-05-17T21:21:41+00:00",
        "2023-04-17T21:21:41+00:00",
        "2023-03-17T21:21:41+00:00",
        "2023-02-17T22:21:41+00:00",
        "2023-01-17T22:21:41+00:00"
    ],
    "fertilize": [
        "2024-04-14T01:36:43+00:00",
        "2024-04-01T05:17:43+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-24T01:51:30+00:00",
        "2024-03-23T05:20:10+00:00",
        "2024-03-22T01:51:30+00:00",
        "2023-11-23T01:38:19+00:00",
        "2023-11-22T01:38:19+00:00",
        "2023-11-18T01:38:19+00:00"
    ],
    "prune": [
        "2024-04-14T01:36:43+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-25T02:50:21+00:00",
        "2023-11-18T01:38:19+00:00"
    ],
    "repot": [
        "2024-04-12T19:33:57+00:00",
        "2024-03-13T22:20:00+00:00"
    ]
};

export const mockphotos = [
    {
        "timestamp": "2024-03-25T15:28:39+00:00",
        "image": "/media/images/IMG_8103.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8103_thumb.webp",
        "preview": "/media/previews/IMG_8103_preview.webp",
        "key": 24
    },
    {
        "timestamp": "2024-03-25T15:28:36+00:00",
        "image": "/media/images/IMG_8102.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8102_thumb.webp",
        "preview": "/media/previews/IMG_8102_preview.webp",
        "key": 25
    },
    {
        "timestamp": "2024-03-25T15:28:33+00:00",
        "image": "/media/images/IMG_8101.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8101_thumb.webp",
        "preview": "/media/previews/IMG_8101_preview.webp",
        "key": 26
    },
    {
        "timestamp": "2024-03-25T14:34:15+00:00",
        "image": "/media/images/IMG_8098.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8098_thumb.webp",
        "preview": "/media/previews/IMG_8098_preview.webp",
        "key": 23
    },
    {
        "timestamp": "2024-03-25T14:34:10+00:00",
        "image": "/media/images/IMG_8097.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8097_thumb.webp",
        "preview": "/media/previews/IMG_8097_preview.webp",
        "key": 21
    },
    {
        "timestamp": "2024-03-25T13:28:54+00:00",
        "image": "/media/images/IMG_8095.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8095_thumb.webp",
        "preview": "/media/previews/IMG_8095_preview.webp",
        "key": 20
    },
    {
        "timestamp": "2024-03-25T13:28:46+00:00",
        "image": "/media/images/IMG_8094.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8094_thumb.webp",
        "preview": "/media/previews/IMG_8094_preview.webp",
        "key": 22
    },
    {
        "timestamp": "2024-03-25T13:28:41+00:00",
        "image": "/media/images/IMG_8093.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8093_thumb.webp",
        "preview": "/media/previews/IMG_8093_preview.webp",
        "key": 27
    },
    {
        "timestamp": "2024-03-25T13:28:30+00:00",
        "image": "/media/images/IMG_8092.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8092_thumb.webp",
        "preview": "/media/previews/IMG_8092_preview.webp",
        "key": 28
    },
    {
        "timestamp": "2024-03-25T13:28:19+00:00",
        "image": "/media/images/IMG_8091.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8091_thumb.webp",
        "preview": "/media/previews/IMG_8091_preview.webp",
        "key": 29
    },
    {
        "timestamp": "2024-03-25T13:27:00+00:00",
        "image": "/media/images/IMG_8090.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8090_thumb.webp",
        "preview": "/media/previews/IMG_8090_preview.webp",
        "key": 30
    },
    {
        "timestamp": "2024-03-25T13:26:48+00:00",
        "image": "/media/images/IMG_8089.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8089_thumb.webp",
        "preview": "/media/previews/IMG_8089_preview.webp",
        "key": 31
    },
    {
        "timestamp": "2024-02-21T21:21:17+00:00",
        "image": "/media/images/IMG_7598.jpeg",
        "thumbnail": "/media/thumbnails/IMG_7598_thumb.webp",
        "preview": "/media/previews/IMG_7598_preview.webp",
        "key": 45
    },
    {
        "timestamp": "2023-11-21T11:57:26+00:00",
        "image": "/media/images/IMG_5866.jpeg",
        "thumbnail": "/media/thumbnails/IMG_5866_thumb.webp",
        "preview": "/media/previews/IMG_5866_preview.webp",
        "key": 46
    },
    {
        "timestamp": "2023-09-12T01:59:28+00:00",
        "image": "/media/images/IMG_5040.jpeg",
        "thumbnail": "/media/thumbnails/IMG_5040_thumb.webp",
        "preview": "/media/previews/IMG_5040_preview.webp",
        "key": 17
    },
    {
        "timestamp": "2023-08-24T04:43:30+00:00",
        "image": "/media/images/IMG_4813.jpeg",
        "thumbnail": "/media/thumbnails/IMG_4813_thumb.webp",
        "preview": "/media/previews/IMG_4813_preview.webp",
        "key": 16
    },
    {
        "timestamp": "2008-08-22T19:00:43+00:00",
        "image": "/media/images/IMG_4811.jpeg",
        "thumbnail": "/media/thumbnails/IMG_4811_thumb.jpeg",
        "preview": "/media/previews/IMG_4811_preview.jpeg",
        "key": 44
    }
];


export const mockNotes = [
    {
        "timestamp": "2024-03-25T15:28:39+00:00",
        "text": "Fertilized with a balanced 10-10-10 fertilizer."
    },
    {
        "timestamp": "2024-02-21T21:21:17+00:00",
        "text": "Noticed some yellow leaves, reduced watering and moved it away from direct sunlight."
    },
    {
        "timestamp": "2023-11-21T11:57:26+00:00",
        "text": "Discovered aphids and applied the strongest pesticide I have, fuck aphids."
    },
    {
        "timestamp": "2023-09-12T01:59:28+00:00",
        "text": "Needs to get repotted soon, roots are starting to grow through the bottom."
    },
    {
        "timestamp": "2023-08-29T04:43:30+00:00",
        "text": "Pruned a little to encourage new growth, removed dead heads and weaker branches."
    },
    {
        "timestamp": "2008-08-22T19:00:43+00:00",
        "text": "Flowers look like they will open within a couple days."
    }
];
