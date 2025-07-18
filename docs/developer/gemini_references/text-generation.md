**Text generation**

The Gemini API can generate text output from various inputs, including
text, images, video, and audio, leveraging Gemini models.

Here's a basic example that takes a single text input:

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "How does AI work?",
  });

  console.log(response.text);
}

await main();
```

**System instructions and configurations**

You can guide the behavior of Gemini models with system instructions. To
do so, pass a [GenerateContentConfig](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig) object.

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Hello there",
    config: {
      systemInstruction: "You are a cat. Your name is Neko.",
    },
  });

  console.log(response.text);
}

await main();
```

The [GenerateContentConfig](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig) object
also lets you override default generation parameters, such as [temperature](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig).

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Explain how AI works",
    config: {
      maxOutputTokens: 500,
      temperature: 0.1,
    },
  });

  console.log(response.text);
}

await main();
```

Refer to the [GenerateContentConfig](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig) in
our API reference for a complete list of configurable parameters and
their descriptions.

**Multimodal inputs**

The Gemini API supports multimodal inputs, allowing you to combine text
with media files. The following example demonstrates providing an image:

JavaScript

```javascript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const image = await ai.files.upload({
    file: "/path/to/organ.png",
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      createUserContent([
        "Tell me about this instrument",
        createPartFromUri(image.uri, image.mimeType),
      ]),
    ],
  });

  console.log(response.text);
}

await main();
```

For alternative methods of providing images and more advanced image
processing, see our [image understanding guide](https://ai.google.dev/gemini-api/docs/image-understanding).
The API also supports [document](https://ai.google.dev/gemini-api/docs/document-processing), [video](https://ai.google.dev/gemini-api/docs/video-understanding),
and [audio](https://ai.google.dev/gemini-api/docs/audio) inputs and understanding.

**Streaming responses**

By default, the model returns a response only after the entire
generation process is complete.

For more fluid interactions, use streaming to
receive [GenerateContentResponse](https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse) instances
incrementally as they're generated.

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const response = await ai.models.generateContentStream({
    model: "gemini-2.0-flash",
    contents: "Explain how AI works",
  });

  for await (const chunk of response) {
    console.log(chunk.text);
  }
}

await main();
```

**Multi-turn conversations (Chat)**

Our SDKs provide functionality to collect multiple rounds of prompts and
responses into a chat, giving you an easy way to keep track of the
conversation history.

**Note:** Chat functionality is only implemented as part of the SDKs.
Behind the scenes, it still uses the [generateContent](https://ai.google.dev/api/generate-content#method:-models.generatecontent) API.

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: [
      {
        role: "user",
        parts: [{ text: "Hello" }],
      },
      {
        role: "model",
        parts: [{ text: "Great to meet you. What would you like to know?" }],
      },
    ],
  });

  const response1 = await chat.sendMessage({
    message: "I have 2 dogs in my house.",
  });

  console.log("Chat response 1:", response1.text);

  const response2 = await chat.sendMessage({
    message: "How many paws are in my house?",
  });

  console.log("Chat response 2:", response2.text);
}

await main();
```

Streaming can also be used for multi-turn conversations.

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

async function main() {
  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: [
      {
        role: "user",
        parts: [{ text: "Hello" }],
      },
      {
        role: "model",
        parts: [{ text: "Great to meet you. What would you like to know?" }],
      },
    ],
  });

  const stream1 = await chat.sendMessageStream({
    message: "I have 2 dogs in my house.",
  });

  for await (const chunk of stream1) {
    console.log(chunk.text);
    console.log("_".repeat(80));
  }

  const stream2 = await chat.sendMessageStream({
    message: "How many paws are in my house?",
  });

  for await (const chunk of stream2) {
    console.log(chunk.text);
    console.log("_".repeat(80));
  }
}

await main();
```

**Supported models**

All models in the Gemini family support text generation. To learn more
about the models and their capabilities, visit the [Models](https://ai.google.dev/gemini-api/docs/models) page.

**Best practices**

**Prompting tips**

For basic text generation, a [zero-shot](https://ai.google.dev/gemini-api/docs/prompting-strategies#few-shot) prompt
often suffices without needing examples, system instructions or specific
formatting.

For more tailored outputs:

- Use [System instructions](https://ai.google.dev/gemini-api/docs/document-processing#system-instructions) to guide the model.
- Provide few example inputs and outputs to guide the model. This is often referred to as [few-shot](https://ai.google.dev/gemini-api/docs/prompting-strategies#few-shot) prompting.
- Consider [fine-tuning](https://ai.google.dev/gemini-api/docs/model-tuning) for advanced use cases.

Consult our [prompt engineering guide](https://ai.google.dev/gemini/docs/prompting-strategies) for more tips.

**Structured output**

In some cases, you may need structured output, such as JSON. Refer to
our [structured output](https://ai.google.dev/gemini-api/docs/structured-output) guide to learn how.