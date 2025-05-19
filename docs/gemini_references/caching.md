**Caching**

Context caching allows you to save and reuse precomputed input tokens
that you wish to use repeatedly, for example when asking different
questions about the same media file. This can lead to cost and speed
savings, depending on the usage. For a detailed introduction, see
the [Context caching](https://ai.google.dev/gemini-api/docs/caching) guide.

## Method: cachedContents.create

Creates CachedContent resource.

**Endpoint**

```
POST https://generativelanguage.googleapis.com/v1beta/cachedContents
```

**Request body**

The request body contains an instance
of [CachedContent](https://ai.google.dev/api/caching#CachedContent).

Fields:

- **contents[]**: object ([Content](https://ai.google.dev/api/caching#Content))
  - Optional. Input only. Immutable. The content to cache.

- **tools[]**: object ([Tool](https://ai.google.dev/api/caching#Tool))
  - Optional. Input only. Immutable. A list of Tools the model may use to generate the next response

- **expiration**: Union type
  - Specifies when this resource will expire. expiration can be only one of the following:

  - **expireTime**: string ([Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp) format)
    - Timestamp in UTC of when this resource is considered expired. This is *always* provided on output, regardless of what was sent on input.
    - Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted.
    - Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

  - **ttl**: string ([Duration](https://protobuf.dev/reference/protobuf/google.protobuf/#duration) format)
    - Input only. New TTL for this resource, input only.
    - A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

- **displayName**: string
  - Optional. Immutable. The user-generated meaningful display name of the cached content. Maximum 128 Unicode characters.

- **model**: string
  - Required. Immutable. The name of the Model to use for cached content
  - Format: models/{model}

- **systemInstruction**: object ([Content](https://ai.google.dev/api/caching#Content))
  - Optional. Input only. Immutable. Developer set system instruction. Currently text only.

- **toolConfig**: object ([ToolConfig](https://ai.google.dev/api/caching#ToolConfig))
  - Optional. Input only. Immutable. Tool config. This config is shared for all tools.

**Example request**

```javascript
// Make sure to include the following import:
// import {GoogleGenAI, createUserContent, createPartFromUri} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);

const modelName = "gemini-1.5-flash-001";
const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});
console.log("Cache created:", cache);

const response = await ai.models.generateContent({
  model: modelName,
  contents: "Please summarize this transcript",
  config: { cachedContent: cache.name },
});
console.log("Response text:", response.text);
```

**Response body**

If successful, the response body contains a newly created instance
of [CachedContent](https://ai.google.dev/api/caching#CachedContent).

## Method: cachedContents.list

Lists CachedContents.

**Endpoint**

```
GET https://generativelanguage.googleapis.com/v1beta/cachedContents
```

**Query parameters**

- **pageSize**: integer
  - Optional. The maximum number of cached contents to return. The service may return fewer than this value. If unspecified, some default (under maximum) number of items will be returned. The maximum value is 1000; values above 1000 will be coerced to 1000.

- **pageToken**: string
  - Optional. A page token, received from a previous cachedContents.list call. Provide this to retrieve the subsequent page.
  - When paginating, all other parameters provided to cachedContents.list must match the call that provided the page token.

**Request body**

The request body must be empty.

**Response body**

Response with CachedContents list.

If successful, the response body contains data with the following structure:

Fields:

- **cachedContents[]**: object ([CachedContent](https://ai.google.dev/api/caching#CachedContent))
  - List of cached contents.

- **nextPageToken**: string
  - A token, which can be sent as pageToken to retrieve the next page. If this field is omitted, there are no subsequent pages.

**JSON representation**
```json
{
  "cachedContents": [
    {
      object (CachedContent)
    }
  ],
  "nextPageToken": string
}
```

## Method: cachedContents.get

Reads CachedContent resource.

**Endpoint**

```
GET https://generativelanguage.googleapis.com/v1beta/{name=cachedContents/*}
```

**Path parameters**

- **name**: string
  - Required. The resource name referring to the content cache entry.
  - Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.

**Request body**

The request body must be empty.

**Example request**

```javascript
// Make sure to include the following import:
// import {GoogleGenAI, createUserContent, createPartFromUri} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);

const modelName = "gemini-1.5-flash-001";
const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});

const retrievedCache = await ai.caches.get({ name: cache.name });
console.log("Retrieved Cache:", retrievedCache);
```

**Response body**

If successful, the response body contains an instance
of [CachedContent](https://ai.google.dev/api/caching#CachedContent).

## Method: cachedContents.patch

Updates CachedContent resource (only expiration is updatable).

**Endpoint**

```
PATCH https://generativelanguage.googleapis.com/v1beta/{cachedContent.name=cachedContents/*}
```

**Path parameters**

- **cachedContent.name**: string
  - Output only. Identifier. The resource name referring to the cached content.
  - Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.

**Query parameters**

- **updateMask**: string ([FieldMask](https://protobuf.dev/reference/protobuf/google.protobuf/#field-mask) format)
  - The list of fields to update.
  - This is a comma-separated list of fully qualified names of fields. Example: "user.displayName,photo".

**Request body**

The request body contains an instance of [CachedContent](https://ai.google.dev/api/caching#CachedContent).

Fields:

- **expiration**: Union type
  - Specifies when this resource will expire. expiration can be only one of the following:

  - **expireTime**: string ([Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp) format)
    - Timestamp in UTC of when this resource is considered expired. This is *always* provided on output, regardless of what was sent on input.
    - Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted.
    - Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

  - **ttl**: string ([Duration](https://protobuf.dev/reference/protobuf/google.protobuf/#duration) format)
    - Input only. New TTL for this resource, input only.
    - A duration in seconds with up to nine fractional digits, ending with 's'. Example: "3.5s".

**Example request**

```javascript
// Make sure to include the following import:
// import {GoogleGenAI, createUserContent, createPartFromUri} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);

const modelName = "gemini-1.5-flash-001";
const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

let cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});

// Update the cache's time-to-live (ttl)
const ttl = `${2 * 3600}s`; // 2 hours in seconds
cache = await ai.caches.update({
  name: cache.name,
  config: { ttl },
});
console.log("After update (TTL):", cache);

// Alternatively, update the expire_time directly (in RFC 3339 format with a "Z" suffix)
const expireTime = new Date(Date.now() + 15 * 60000)
  .toISOString()
  .replace(/\.\d{3}Z$/, "Z");

cache = await ai.caches.update({
  name: cache.name,
  config: { expireTime: expireTime },
});
console.log("After update (expire_time):", cache);
```

**Response body**

If successful, the response body contains an instance
of [CachedContent](https://ai.google.dev/api/caching#CachedContent).

## Method: cachedContents.delete

Deletes CachedContent resource.

**Endpoint**

```
DELETE https://generativelanguage.googleapis.com/v1beta/{name=cachedContents/*}
```

**Path parameters**

- **name**: string
  - Required. The resource name referring to the content cache entry
  - Format: cachedContents/{id} It takes the form cachedContents/{cachedcontent}.

**Request body**

The request body must be empty.

**Example request**

```javascript
// Make sure to include the following import:
// import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const filePath = path.join(media, "a11.txt");
const document = await ai.files.upload({
  file: filePath,
  config: { mimeType: "text/plain" },
});
console.log("Uploaded file name:", document.name);

const modelName = "gemini-1.5-flash-001";

// Create the cache
const contents = [
  createUserContent(createPartFromUri(document.uri, document.mimeType)),
];

const cache = await ai.caches.create({
  model: modelName,
  config: {
    contents: contents,
    systemInstruction: "You are an expert analyzing transcripts.",
  },
});

// Delete the cache when it's no longer needed
await ai.caches.delete({ name: cache.name });
console.log("Cache deleted successfully");
```