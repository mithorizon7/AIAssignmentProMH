# Gemini API Schema Reference

This document covers the Schema objects and resource types used across the Gemini API.

## Resource: CachedContent

Content that has been preprocessed and can be used in subsequent requests to GenerativeService.
Cached content can be only used with the model it was created for.

**Fields**

- **contents[]**: object ([Content](https://ai.google.dev/api/caching#Content))
  - Optional. Input only. Immutable. The content to cache.

- **tools[]**: object ([Tool](https://ai.google.dev/api/caching#Tool))
  - Optional. Input only. Immutable. A list of Tools the model may use to generate the next response

- **createTime**: string ([Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp) format)
  - Output only. Creation time of the cache entry.
  - Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits. 
  - Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

- **updateTime**: string ([Timestamp](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp) format)
  - Output only. When the cache entry was last updated in UTC time.
  - Uses RFC 3339, where generated output will always be Z-normalized and uses 0, 3, 6 or 9 fractional digits.
  - Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".

- **usageMetadata**: object ([UsageMetadata](https://ai.google.dev/api/caching#UsageMetadata))
  - Output only. Metadata on the usage of the cached content.

- **name**: string
  - Output only. Identifier. The resource name referring to the cached content.
  - Format: cachedContents/{cachedcontent}

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

## Resource: Content

The base structured datatype containing multi-part content of various types.

**Fields**

- **parts[]**: object ([Part](https://ai.google.dev/api/caching#Part))
  - Required. Ordered parts that make up the content.

- **role**: string
  - Optional. Indicates the role of the content.

## Resource: ContentPair

A pair of contents used by the model to answer a query.

**Fields**

- **content**: object ([Content](https://ai.google.dev/api/caching#Content))
  - Required. A single part query.

- **response**: object ([Content](https://ai.google.dev/api/caching#Content))
  - Required. A single part response corresponding to the query.

## Resource: Part

A datatype containing media that is part of a multi-part content message.

**Fields**

The part message can contain different types of data, but only one will be used:

- **text**: string
  - Optional. Text part.

- **functionCall**: object ([FunctionCall](https://ai.google.dev/api/caching#FunctionCall))
  - Optional. Executes a function defined in a Tool.

- **functionResponse**: object ([FunctionResponse](https://ai.google.dev/api/caching#FunctionResponse))
  - Optional. Result of executing a function defined in a Tool.

- **inlineData**: object
  - Optional. A data URI encoded string of the media data.

  - **mimeType**: string
    - Required. MIME type of the data.

  - **data**: string
    - Required. Base64 encoded data.

- **fileData**: object
  - Optional. Reference to a file in the system.

  - **fileUri**: string
    - Required. URI of file.

  - **mimeType**: string
    - Required. MIME type of the file.

## Resource: Tool

Defines a Tool that the model may use to generate its final response.

**Fields**

- **functionDeclarations[]**: object ([FunctionDeclaration](https://ai.google.dev/api/caching#FunctionDeclaration))
  - Required. List of functions defined for the Tool.

## Resource: ToolConfig

Represents tool-specific configuration information for certain tools.

**Fields**

- **functionCallingConfig**: object
  - Optional. Function calling configuration for function calling tools.

  - **mode**: string
    - Optional. Defines how the model decides when to call a function. Valid values: AUTOMATIC, ANY, or OFF.
    - AUTOMATIC (default): Model decides when to call a function.
    - ANY: Model can call any function defined in Tools.
    - OFF: Disables function calling.

  - **allowedFunctionNames[]**: string
    - Optional. If non-empty, model is restricted to only call functions defined in this list.
    - Used with mode=AUTOMATIC or mode=ANY.

## Resource: FunctionDeclaration

Defines a function that a model may call.

**Fields**

- **name**: string
  - Required. Name of the function.

- **description**: string
  - Optional. Description of the function.

- **parameters**: object ([Schema](https://ai.google.dev/api/caching#Schema))
  - Optional. Parameters that the function accepts.

## Resource: FunctionCall

Represents a call to a declared function.

**Fields**

- **name**: string
  - Required. Name of the function.

- **args**: object
  - Required. Arguments to pass to the function.

## Resource: FunctionResponse

Represents a response to a FunctionCall.

**Fields**

- **name**: string
  - Required. Name of the function called.

- **response**: object
  - Optional. Response from the function call.

## Resource: Schema

Represents the schema of an object.

**Fields**

- **type**: string (Type)
  - Required. Type of schema. Valid values: "STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT".

- **format**: string
  - Optional. Format hint for schema type. Example: "date-time" for strings, "int64" for integers.

- **description**: string
  - Optional. Description of schema.

- **nullable**: boolean
  - Optional. Whether a null value is allowed.

- **enum[]**: string
  - Optional. Enumerated string values. Only valid for type="STRING".

- **minimum**: number
  - Optional. Minimum value. Only valid for type="NUMBER" or type="INTEGER".

- **maximum**: number
  - Optional. Maximum value. Only valid for type="NUMBER" or type="INTEGER".

- **minItems**: integer
  - Optional. Minimum number of items. Only valid for type="ARRAY".

- **maxItems**: integer
  - Optional. Maximum number of items. Only valid for type="ARRAY".

- **items**: object ([Schema](https://ai.google.dev/api/caching#Schema))
  - Optional. Schema for array items. Only valid for type="ARRAY".

- **properties**: object
  - Optional. Nested object property schemas. Only valid for type="OBJECT".
  - Maps property names to Schema objects.

- **required[]**: string
  - Optional. Required properties. Only valid for type="OBJECT".

- **propertyOrdering[]**: string
  - Optional. Ordering of properties in output JSON. Only valid for type="OBJECT".
  - This is not a standard OpenAPI field. It helps ensure consistent property ordering in outputs.

## Resource: UsageMetadata

Metadata about resource usage.

**Fields**

- **promptTokenCount**: integer (int64 format)
  - Output only. Token count for the prompt portion.

- **candidatesTokenCount**: integer (int64 format)
  - Output only. Token count for the candidates portion.

- **totalTokenCount**: integer (int64 format)
  - Output only. Total token count (prompt + candidates).