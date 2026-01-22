# LiveGolfAPI.com Integration Documentation

## API Endpoints

### Base URL
`https://use.livegolfapi.com`

### Authentication
Use `x-api-key` header with your API key:
```
x-api-key: YOUR_API_KEY
```

## Endpoints

### 1. Get All Events/Tournaments
```
GET /v1/events
```

**Response Example:**
```json
[
  {
    "id": "272e7c64-be4c-4081-8423-6d07af029626",
    "sport": {
      "id": "c80da94a-92f0-4913-9767-bac259120b37",
      "name": "Golf",
      "slug": "golf"
    },
    "tour": {
      "id": "e4392b74-6521-4187-a3b3-de226859dd16",
      "fullName": "PGA Tour",
      "name": "PGA Tour",
      "slug": "pga-tour"
    },
    "startDatetime": "2026-01-15 00:00:00+00",
    "endDatetime": "2026-01-19 00:00:00+00",
    "name": "Sony Open in Hawaii",
    "slug": "sony-open-in-hawaii-2026",
    "course": "Waialae Country Club",
    "location": "Honolulu, Hawaii",
    "status": "Completed"
  }
]
```

### 2. Get Tournament Leaderboard/Scores
```
GET /v1/events/{event_id}
```

**Response Structure:**
```json
[
  {
    "id": "player-scorecard-id",
    "tournament": "272e7c64-be4c-4081-8423-6d07af029626",
    "player": "Player Name",
    "position": "T24",           // Position string (T24, T31, CUT, WD)
    "positionValue": 24,         // Numeric position (980 for CUT, 990 for WD)
    "total": "-7",               // Total score relative to par (string)
    "strokes": "273",            // Total strokes (string)
    "rounds": [
      {
        "id": "round-id",
        "scorecard": "scorecard-id",
        "round": 1,
        "startingTee": 1,
        "teeTime": "2026-01-15T17:54:00+00:00",
        "position": "T24",
        "total": "-2",           // Cumulative score after this round
        "thru": "18",            // Holes completed
        "scores": null,          // Hole-by-hole scores (usually null)
        "score": 70              // Round score
      }
    ]
  }
]
```

## Data Mapping

### Position Mapping
- `"T24"` → position 24
- `"CUT"` → positionValue 980, made_cut = false
- `"WD"` → positionValue 990, withdrawn

### Score Mapping
- `total` field: Score relative to par (e.g., "-7", "+3", "E")
- `strokes` field: Total strokes (numeric string)
- `rounds[].score`: Individual round score

### Cut Status
- `positionValue < 100` → made_cut = true
- `positionValue >= 980` → made_cut = false

## Example curl Commands

### Get All Events
```bash
curl -X GET 'https://use.livegolfapi.com/v1/events' \
  -H 'x-api-key: YOUR_API_KEY'
```

### Get Tournament Leaderboard
```bash
curl -X GET 'https://use.livegolfapi.com/v1/events/272e7c64-be4c-4081-8423-6d07af029626' \
  -H 'x-api-key: YOUR_API_KEY'
```

## Integration Notes

1. **Player Matching**: Match players by name between LiveGolfAPI and your database
2. **Score Parsing**: Parse `total` field to get numeric score (e.g., "-7" → -7)
3. **Position Parsing**: Extract numeric position from `positionValue` (ignore values >= 980)
4. **Round Scores**: Map `rounds` array to `round_1_score`, `round_2_score`, etc.
5. **Cut Status**: Determine from `positionValue` (980 = CUT, 990 = WD)
