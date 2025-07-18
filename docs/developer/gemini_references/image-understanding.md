**Image understanding**

Gemini models can process images, enabling many frontier developer use
cases that would have historically required domain specific models. Some
of Gemini's vision capabilities include the ability to:

- Caption and answer questions about images
- Transcribe and reason over PDFs, including up to 2 million tokens
- Detect objects in an image and return bounding box coordinates for them
- Segment objects within an image

Gemini was built to be multimodal from the ground up and we continue to
push the frontier of what is possible. This guide shows how to use the
Gemini API to generate text responses based on image inputs and perform
common image understanding tasks.

**Image input**

You can provide images as input to Gemini in the following ways:

- [Upload an image file](https://ai.google.dev/gemini-api/docs/image-understanding#upload-image) using
  the File API before making a request to generateContent. Use this
  method for files larger than 20MB or when you want to reuse the file
  across multiple requests.

- [Pass inline image data](https://ai.google.dev/gemini-api/docs/image-understanding#inline-image) with
  the request to generateContent. Use this method for smaller files
  (<20MB total request size) or images fetched directly from URLs.

**Upload an image file**

You can use the [Files API](https://ai.google.dev/gemini-api/docs/files) to upload
an image file. Always use the Files API when the total request size
(including the file, text prompt, system instructions, etc.) is larger
than 20 MB, or if you intend to use the same image in multiple prompts.

The following code uploads an image file and then uses the file in a
call to generateContent.

JavaScript

```javascript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  const myfile = await ai.files.upload({
    file: "path/to/sample.jpg",
    config: { mimeType: "image/jpeg" },
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: createUserContent([
      createPartFromUri(myfile.uri, myfile.mimeType),
      "Caption this image.",
    ]),
  });

  console.log(response.text);
}

await main();
```

To learn more about working with media files, see [Files API](https://ai.google.dev/gemini-api/docs/files).

**Pass image data inline**

Instead of uploading an image file, you can pass inline image data in
the request to generateContent. This is suitable for smaller images
(less than 20MB total request size) or images fetched directly from
URLs.

You can provide image data as Base64 encoded strings or by reading local
files directly (depending on the SDK).

**Local image file:**

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

const base64ImageFile = fs.readFileSync("path/to/small-sample.jpg", {
  encoding: "base64",
});

const contents = [
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64ImageFile,
    },
  },
  { text: "Caption this image." },
];

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: contents,
});

console.log(response.text);
```

**Image from URL:**

JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

  const imageUrl = "https://goo.gle/instrument-img";
  const response = await fetch(imageUrl);
  const imageArrayBuffer = await response.arrayBuffer();
  const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64ImageData,
        },
      },
      { text: "Caption this image." }
    ],
  });

  console.log(result.text);
}

main();
```

A few things to keep in mind about inline image data:

- The maximum total request size is 20 MB, which includes text prompts,
  system instructions, and all files provided inline. If your file's
  size will make the *total request size* exceed 20 MB, then use the
  Files API to [upload an image file](https://ai.google.dev/gemini-api/docs/image-understanding#upload-image) for
  use in the request.

- If you're using an image sample multiple times, it's more efficient
  to [upload an image file](https://ai.google.dev/gemini-api/docs/image-understanding#upload-image) using
  the File API.

**Prompting with multiple images**

You can provide multiple images in a single prompt by including multiple
image Part objects in the contents array. These can be a mix of inline
data (local files or URLs) and File API references.

JavaScript

```javascript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  // Upload the first image
  const image1_path = "path/to/image1.jpg";
  const uploadedFile = await ai.files.upload({
    file: image1_path,
    config: { mimeType: "image/jpeg" },
  });

  // Prepare the second image as inline data
  const image2_path = "path/to/image2.png";
  const base64Image2File = fs.readFileSync(image2_path, {
    encoding: "base64",
  });

  // Create the prompt with text and multiple images
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: createUserContent([
      "What is different between these two images?",
      createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Image2File,
        },
      },
    ]),
  });

  console.log(response.text);
}

await main();
```

**Get a bounding box for an object**

Gemini models are trained to identify objects in an image and provide
their bounding box coordinates. The coordinates are returned relative to
the image dimensions, scaled to [0, 1000]. You need to descale these
coordinates based on your original image size.

JavaScript

```javascript
const prompt = "Detect the all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000.";
```

You can use bounding boxes for object detection and localization within
images and video. By accurately identifying and delineating objects with
bounding boxes, you can unlock a wide range of applications and enhance
the intelligence of your projects.

**Key benefits**

- **Simple:** Integrate object detection capabilities into your
  applications with ease, regardless of your computer vision expertise.

- **Customizable:** Produce bounding boxes based on custom instructions
  (e.g. "I want to see bounding boxes of all the green objects in this
  image"), without having to train a custom model.

**Technical details**

- **Input:** Your prompt and associated images or video frames.

- **Output:** Bounding boxes in the [y_min, x_min, y_max,
  x_max] format. The top left corner is the origin. The x and y axis go
  horizontally and vertically, respectively. Coordinate values are
  normalized to 0-1000 for every image.

- **Visualization:** AI Studio users will see bounding boxes plotted
  within the UI.

For Python developers, try the [2D spatial understanding notebook](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Spatial_understanding.ipynb) or
the [experimental 3D pointing notebook](https://github.com/google-gemini/cookbook/blob/main/examples/Spatial_understanding_3d.ipynb).

**Normalize coordinates**

The model returns bounding box coordinates in the format [y_min, x_min,
y_max, x_max]. To convert these normalized coordinates to the pixel
coordinates of your original image, follow these steps:

1.  Divide each output coordinate by 1000.

2.  Multiply the x-coordinates by the original image width.

3.  Multiply the y-coordinates by the original image height.

To explore more detailed examples of generating bounding box coordinates
and visualizing them on images, review the [Object Detection cookbook example](https://github.com/google-gemini/cookbook/blob/main/examples/Object_detection.ipynb).

**Image segmentation**

Starting with the Gemini 2.5 models, Gemini models are trained to not
only detect items but also segment them and provide a mask of their
contours.

The model predicts a JSON list, where each item represents a
segmentation mask. Each item has a bounding box ("box_2d") in the
format [y0, x0, y1, x1] with normalized coordinates between 0 and
1000, a label ("label") that identifies the object, and finally the
segmentation mask inside the bounding box, as base64 encoded png that is
a probability map with values between 0 and 255. The mask needs to be
resized to match the bounding box dimensions, then binarized at your
confidence threshold (127 for the midpoint).

JavaScript

```javascript
const prompt = `
Give the segmentation masks for the wooden and glass items.

Output a JSON list of segmentation masks where each entry contains the 2D
bounding box in the key "box_2d", the segmentation mask in key "mask", and
the text label in the key "label". Use descriptive labels.
`;
```

Check the [segmentation example](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Spatial_understanding.ipynb#scrollTo=WQJTJ8wdGOKx) in
the cookbook guide for a more detailed example.

**Supported image formats**

Gemini supports the following image format MIME types:

- PNG - image/png
- JPEG - image/jpeg
- WEBP - image/webp
- HEIC - image/heic
- HEIF - image/heif

**Technical details about images**

- **File limit**: Gemini 2.5 Pro, 2.0 Flash, 1.5 Pro, and 1.5 Flash
  support a maximum of 3,600 image files per request.

- **Token calculation**:
  - **Gemini 1.5 Flash and Gemini 1.5 Pro**: 258 tokens if both
    dimensions <= 384 pixels. Larger images are tiled (min tile 256px,
    max 768px, resized to 768x768), with each tile costing 258 tokens.
  - **Gemini 2.0 Flash**: 258 tokens if both dimensions <= 384 pixels.
    Larger images are tiled into 768x768 pixel tiles, each costing 258
    tokens.

- **Best practices**:
  - Ensure images are correctly rotated.
  - Use clear, non-blurry images.
  - When using a single image with text, place the text
    prompt *after* the image part in the contents array.