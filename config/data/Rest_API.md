## Messaging API

The Messaging API is the system's core service, allowing you to automatically send various types of messages to active WhatsApp numbers. This API is designed to be easy to use, flexible, and can be integrated with your internal systems such as chatbots, notification systems, CRM, e-commerce, and more.

### Authorization

All requests must use the following headers:

```json
"token: your_token"
```

---

### Request Body Format

| Field | Type | Required | Description |
| --------- | --------------- | ----- | ----------------------------------------------- |
| `session` | string          | ✅ | The number of sessions that have been connected. |
| `to`      | string          | ✅ | Destination number in international format.|
| `type`    | string          | ✅ | Message types: `text`, `image`, `video`, etc. |
| `content` | object / string | ✅ | Message content according to the type used. |

---

### Message Type

#### Text

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "text",
  "content": "Hello this is a message from Fhytsbot"
}
```

---

#### Image

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "image",
  "content": {
    "image_url": "https://example.com/image.png",
    "caption": "Hello this is a message from Fhytsbot"
  }
}
```

| Field | Type | Required | Description |
| ----------- | ------ | ----- | ---------------------------- |
| `image_url` | string | ✅ | Image URL (JPG/PNG format). |
| `caption` | string | ❌ | Optional caption text. |

---

#### Video

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "video",
  "content": {
    "video_url": "https://example.com/video.mp4",
    "caption": "Hello this is a message from Fhytsbot"
  }
}
```

| Field | Type | Required | Description |
| ----------- | ------ | ----- | ---------------------------- |
| `video_url` | string | ✅ | URL of the video file (MP4). |
| `caption` | string | ❌ | Video caption (optional). |

---

#### Audio

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "audio",
  "content": {
    "audio_url": "https://example.com/audio.mp3"
  }
}
```

| Field | Type | Required | Description |
| ----------- | ------ | ----- | --------------------------- |
| `audio_url` | string | ✅ | URL of the audio file (MP3, OGG). |

---

#### Document

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "document",
  "content": {
	"document_url": "https://example.com/document.pdf",
    "mimetype": "application/pdf",
    "fileName": "Dokumen.pdf",
    "caption": "Hello this is a message from Fhytsbot"
  }
}
```

| Field | Type | Required | Description |
| -------------- | ------ | ----- | ------------------------------------------- |
| `document_url` | string | ✅ | URL of the document file (PDF, XLS, etc.). |
| `mimetype` | string | ✅ | The MIME type of the file, for example `application/pdf`. |
| `fileName` | string | ✅ | The name of the document file to be sent. |
| `caption` | string | ❌ | Additional description or message. |

---

#### Location

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "location",
  "content": {
    "degreesLatitude": -6.200000,
    "degreesLongitude": 106.816666,
    "name": "Jakarta"
  }
}
```

| Field | Type | Required | Description |
| ------------------ | ------ | ----- | ------------------------------ |
| `degreesLatitude` | float | ✅ | The latitude coordinate of the location. |
| `degreesLongitude` | float | ✅ | The longitude coordinate of the location. |
| `name` | string | ❌ | The name of the location (e.g., “Office”). |

---

#### Sticker

```json
{
  "session": "628xxxxxx",
  "to": "628xxxxxx",
  "type": "sticker",
  "content": {
    "url": "https://example.com/sticker.webp"
  }
}
```

| Field | Type | Required | Description |
| ----- | ------ | ----- | --------------------------------- |
| `url` | string | ✅ | URL of the sticker file (`.webp` format). |

---

### Example Response

#### 200 OK

```json
{
  "message": "Message sent successfully."
}
```

---

### Error Response

| Status Code | Message | Explanation |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------- |
| 400 | `"Bad Request: Missing required fields."` | A required field is missing or malformed. |
| 400 | `"Invalid message type."` | The `type` value is invalid (e.g., not `text`, `image`, etc.). |
| 400 | `"Missing image_url."` | A required field in `content` is missing. |
| 401 | `"Unauthorized: Invalid token."` | The token is invalid or was not sent. |
| 404 | `"Session not found or not connected."` | The session number is not registered or has not yet connected to WhatsApp. |
| 503 | `"WhatsApp client not active for this session."` | The number is not yet active on the server. |
| 500 | `"Internal server error."` | Unexpected server error. |
| 500 | `"Failed to send message."` | Failed to send a message to WhatsApp.                       |

---

### Curl Request Example

```bash
curl -X POST https://your-endpoint.com/api/webhook \
  -H "token: your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "session": "628xxxxxx",
    "to": "628xxxxxx",
    "type": "text",
    "content": "Hello this is a message from Fhytsbot"
  }'
```

---

### Note

* The phone number format must include the country code (example: `6281234567890`).
* Ensure the files you send (images, videos, documents) are publicly accessible via URL.
* Ensure your WhatsApp session is active and connected to the server.