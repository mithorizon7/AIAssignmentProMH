**Structured output**

You can configure Gemini for structured output instead of unstructured
text, allowing precise extraction and standardization of information for
further processing. For example, you can use structured output to
extract information from resumes, standardize them to build a structured
database.

Gemini can generate either [JSON](https://ai.google.dev/gemini-api/docs/structured-output#generating-json) or [enum values](https://ai.google.dev/gemini-api/docs/structured-output#generating-enums) as structured output.

**Generating JSON**

There are two ways to generate JSON using the Gemini API:

- Configure a schema on the model
- Provide a schema in a text prompt

Configuring a schema on the model is the **recommended** way to generate
JSON, because it constrains the model to output JSON.

**Configuring a schema (recommended)**

To constrain the model to generate JSON, configure a responseSchema. The
model will then respond to any prompt with JSON-formatted output.

JavaScript

```javascript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "List a few popular cookie recipes, and include the amounts of ingredients.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            recipeName: {
              type: Type.STRING,
            },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
            },
          },
          propertyOrdering: ["recipeName", "ingredients"],
        },
      },
    },
  });

  console.log(response.text);
}

main();
```

The output might look like this:

```json
[
  {
    "recipeName": "Chocolate Chip Cookies",
    "ingredients": [
      "1 cup (2 sticks) unsalted butter, softened",
      "3/4 cup granulated sugar",
      "3/4 cup packed brown sugar",
      "1 teaspoon vanilla extract",
      "2 large eggs",
      "2 1/4 cups all-purpose flour",
      "1 teaspoon baking soda",
      "1 teaspoon salt",
      "2 cups chocolate chips"
    ]
  },
  ...
]
```

**Providing a schema in a text prompt**

Instead of configuring a schema, you can supply a schema as natural
language or pseudo-code in a text prompt. This method is **not
recommended**, because it might produce lower quality output, and
because the model is not constrained to follow the schema.

**Warning:** Don't provide a schema in a text prompt if you're
configuring a **responseSchema**. This can produce unexpected or low
quality results.

Here's a generic example of a schema provided in a text prompt:

```
List a few popular cookie recipes, and include the amounts of ingredients.

Produce JSON matching this specification:
Recipe = { "recipeName": string, "ingredients": array<string> }
Return: array<Recipe>
```

Since the model gets the schema from text in the prompt, you might have
some flexibility in how you represent the schema. But when you supply a
schema inline like this, the model is not actually constrained to return
JSON. For a more deterministic, higher quality response, configure a
schema on the model, and don't duplicate the schema in the text prompt.

**Generating enum values**

In some cases you might want the model to choose a single option from a
list of options. To implement this behavior, you can pass an *enum* in
your schema. You can use an enum option anywhere you could use
a string in the responseSchema, because an enum is an array of strings.
Like a JSON schema, an enum lets you constrain model output to meet the
requirements of your application.

For example, assume that you're developing an application to classify
musical instruments into one of five
categories: "Percussion", "String", "Woodwind", "Brass", or
"Keyboard". You could create an enum to help with this task.

In the following example, you pass an enum as the responseSchema,
constraining the model to choose the most appropriate option.

```javascript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "What type of instrument is an oboe?",
    config: {
      responseMimeType: "text/x.enum",
      responseSchema: {
        type: Type.STRING,
        enum: ["Percussion", "String", "Woodwind", "Brass", "Keyboard"],
      },
    },
  });

  console.log(response.text); // Woodwind
}

main();
```

Beyond basic multiple choice problems, you can use an enum anywhere in a
JSON schema. For example, you could ask the model for a list of recipe
titles and use a Grade enum to give each title a popularity grade:

```javascript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GOOGLE_API_KEY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "List 10 home-baked cookie recipes and give them grades based on tastiness.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            recipe_name: { type: Type.STRING },
            rating: { 
              type: Type.STRING,
              enum: ["a+", "a", "b", "c", "d", "f"] 
            }
          }
        }
      }
    }
  });

  console.log(response.text);
}

main();
```

The response might look like this:

```json
[
  {
    "recipe_name": "Chocolate Chip Cookies",
    "rating": "a+"
  },
  {
    "recipe_name": "Peanut Butter Cookies",
    "rating": "a"
  },
  {
    "recipe_name": "Oatmeal Raisin Cookies",
    "rating": "b"
  },
  ...
]
```

**About JSON schemas**

Configuring the model for JSON output using responseSchema parameter
relies on Schema object to define its structure. This object represents a
select subset of the [OpenAPI 3.0 Schema object](https://spec.openapis.org/oas/v3.0.3#schema-object),
and also adds a propertyOrdering field.

Here's a pseudo-JSON representation of all the Schema fields:

```json
{
  "type": "enum (Type)",
  "format": "string",
  "description": "string",
  "nullable": "boolean",
  "enum": [
    "string"
  ],
  "maxItems": "integer",
  "minItems": "integer",
  "properties": {
    "string": {
      "object (Schema)"
    },
    ...
  },
  "required": [
    "string"
  ],
  "propertyOrdering": [
    "string"
  ],
  "items": {
    "object (Schema)"
  }
}
```

The Type of the schema must be one of the OpenAPI [Data Types](https://spec.openapis.org/oas/v3.0.3#data-types), or
a union of those types (using anyOf). Only a subset of fields is valid
for each Type. The following list maps each Type to a subset of the
fields that are valid for that type:

- string -> enum, format, nullable
- integer -> format, minimum, maximum, enum, nullable
- number -> format, minimum, maximum, enum, nullable
- boolean -> nullable
- array -> minItems, maxItems, items, nullable
- object -> properties, required, propertyOrdering, nullable

Here are some example schemas showing valid type-and-field combinations:

```json
{ "type": "string", "enum": ["a", "b", "c"] }
{ "type": "string", "format": "date-time" }
{ "type": "integer", "format": "int64" }
{ "type": "number", "format": "double" }
{ "type": "boolean" }
{ "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": ... } }
{ "type": "object",
  "properties": {
    "a": { "type": ... },
    "b": { "type": ... },
    "c": { "type": ... }
  },
  "nullable": true,
  "required": ["c"],
  "propertyOrdering": ["c", "b", "a"]
}
```

For complete documentation of the Schema fields as they're used in the
Gemini API, see the [Schema reference](https://ai.google.dev/api/caching#Schema).

**Property ordering**

**Warning:** When you're configuring a JSON schema, make sure to set **propertyOrdering[]**, and when you provide examples, make sure
that the property ordering in the examples matches the schema.

When you're working with JSON schemas in the Gemini API, the order of
properties is important. By default, the API orders properties
alphabetically and does not preserve the order in which the properties
are defined (although the [Google Gen AI SDKs](https://ai.google.dev/gemini-api/docs/sdks) may preserve this order). If you're providing examples to the model with a schema configured, and the property ordering of the examples is not
consistent with the property ordering of the schema, the output could be
rambling or unexpected.

To ensure a consistent, predictable ordering of properties, you can use
the optional propertyOrdering[] field.

```
"propertyOrdering": ["recipeName", "ingredients"]
```

propertyOrdering[] — not a standard field in the OpenAPI
specification — is an array of strings used to determine the order of
properties in the response. By specifying the order of properties and
then providing examples with properties in that same order, you can
potentially improve the quality of results. propertyOrdering is only
valid for object schemas.