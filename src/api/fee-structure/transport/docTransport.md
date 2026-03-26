# Transport API

## GET `/api/transport`

Returns transport master data grouped by `route + busNo`.

### Response

```json
{
	"success": true,
	"message": "Transport configurations retrieved successfully",
	"data": {
		"info": {
			"routes": ["Bharathiyar University", "Town Hall"],
			"busNos": ["1", "2"]
		},
		"detailed": [
			{
				"route": "Bharathiyar University",
				"busNo": "1",
				"stops": [
					{
						"id": "67f0a4f7a0f66b2cf5f41234",
						"stop": "Bharathiyar University",
						"fee": 15000
					}
				]
			}
		]
	}
}
```

## GET `/api/transport?busNo=1`

When `busNo` query param is provided, response `data` returns only filtered grouped records (without `info`).

### Response

```json
{
	"success": true,
	"message": "Transport configurations retrieved successfully",
	"data": [
		{
			"route": "Bharathiyar University",
			"busNo": "1",
			"stops": [
				{
					"id": "67f0a4f7a0f66b2cf5f41234",
					"stop": "Bharathiyar University",
					"fee": 15000
				}
			]
		}
	]
}
```
 