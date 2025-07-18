**Files API**

The Gemini family of artificial intelligence (AI) models is built to
handle various types of input data, including text, images, and audio.
Since these models can handle more than one type or *mode* of data, the
Gemini models are called *multimodal models* or explained as
having *multimodal capabilities*.

This guide shows you how to work with media files using the Files API.
The basic operations are the same for audio files, images, videos,
documents, and other supported file types.

For file prompting guidance, check out the [[File prompt
guide]{.underline}](https://ai.google.dev/gemini-api/docs/files#prompt-guide) section.

**Upload a file**

You can use the Files API to upload a media file. Always use the Files
API when the total request size (including the files, text prompt,
system instructions, etc.) is larger than 20 MB.

The following code uploads a file and then uses the file in a call
to generateContent.

JavaScript

import {

GoogleGenAI,

createUserContent,

createPartFromUri,

} from \"@google/genai\";

const ai = new GoogleGenAI({ apiKey: \"GOOGLE_API_KEY\" });

async function main() {

const myfile = await ai.files.upload({

file: \"path/to/sample.mp3\",

config: { mimeType: \"audio/mpeg\" },

});

const response = await ai.models.generateContent({

model: \"gemini-2.0-flash\",

contents: createUserContent(\[

createPartFromUri(myfile.uri, myfile.mimeType),

\"Describe this audio clip\",

\]),

});

console.log(response.text);

}

await main();

**Get metadata for a file**

You can verify that the API successfully stored the uploaded file and
get its metadata by calling files.get.

JavaScript

const myfile = await ai.files.upload({

file: \"path/to/sample.mp3\",

config: { mimeType: \"audio/mpeg\" },

});

const fileName = myfile.name;

const fetchedFile = await ai.files.get({ name: fileName });

console.log(fetchedFile);

**List uploaded files**

You can upload multiple files using the Files API. The following code
gets a list of all the files uploaded:

JavaScript

const listResponse = await ai.files.list({ config: { pageSize: 10 } });

for await (const file of listResponse) {

console.log(file.name);

}

**Delete uploaded files**

Files are automatically deleted after 48 hours. You can also manually
delete an uploaded file:

JavaScript

const myfile = await ai.files.upload({

file: \"path/to/sample.mp3\",

config: { mimeType: \"audio/mpeg\" },

});

const fileName = myfile.name;

await ai.files.delete({ name: fileName });

**Usage info**

You can use the Files API to upload and interact with media files. The
Files API lets you store up to 20 GB of files per project, with a
per-file maximum size of 2 GB. Files are stored for 48 hours. During
that time, you can use the API to get metadata about the files, but you
can\'t download the files. The Files API is available at no cost in all
regions where the Gemini API is available.

**File prompting strategies**

This section provides guidance and best practices for using media files
with prompts for the Gemini API. 

Being able to use various types of data in your prompts gives you more
flexibility in terms of what tasks you can tackle with the Gemini API.
For example, you can send the model a photo of a delicious meal and ask
it to write a short blog about the meal.

If you are having trouble getting the output you want from prompts that
use media files, there are some strategies that can help you get the
results you want. The following sections provide design approaches and
troubleshooting tips for improving prompts that use multimodal input.

You can improve your multimodal prompts by following these best
practices:

- [**[Prompt design
  fundamentals]{.underline}**](https://ai.google.dev/gemini-api/docs/files#specific-instructions)

  - **Be specific in your instructions**: Craft clear and concise
    instructions that leave minimal room for misinterpretation.

  - **Add a few examples to your prompt:** Use realistic few-shot
    examples to illustrate what you want to achieve.

  - **Break it down step-by-step**: Divide complex tasks into manageable
    sub-goals, guiding the model through the process.

  - **Specify the output format**: In your prompt, ask for the output to
    be in the format you want, like markdown, JSON, HTML and more. 

  - **Put your image first for single-image prompts**: While Gemini can
    handle image and text inputs in any order, for prompts containing a
    single image, it might perform better if that image (or video) is
    placed before the text prompt. However, for prompts that require
    images to be highly interleaved with texts to make sense, use
    whatever order is most natural.

- [**[Troubleshooting your multimodal
  prompt]{.underline}**](https://ai.google.dev/gemini-api/docs/files#troubleshooting)

  - **If the model is not drawing information from the relevant part of
    the image:** Drop hints with which aspects of the image you want the
    prompt to draw information from.

  - **If the model output is too generic (not tailored enough to the
    image/video input): **At the start of the prompt, try asking the
    model to describe the image(s) or video before providing the task
    instruction, or try asking the model to refer to what\'s in the
    image.

  - **To troubleshoot which part failed:** Ask the model to describe the
    image, or ask the model to explain its reasoning, to gauge the
    model\'s initial understanding.

  - **If your prompt results in hallucinated content:** Try dialing down
    the temperature setting or asking the model for shorter descriptions
    so that it\'s less likely to extrapolate additional details.

  - **Tuning the sampling parameters:** Experiment with different
    temperature settings and top-k selections to adjust the model\'s
    creativity.
