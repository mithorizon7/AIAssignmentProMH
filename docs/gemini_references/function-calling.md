# Function Calling in Gemini API

This document covers the function calling capabilities in the Gemini API, which allows the model to invoke functions defined by developers to perform actions or retrieve information.

## Resource: Tool

Defines a Tool that the model may use to generate its final response.

**Fields**

- **functionDeclarations[]**: object ([FunctionDeclaration](#resource-functiondeclaration))
  - Required. List of functions defined for the Tool.

**JSON representation**

```json
{
  "functionDeclarations": [
    {
      object (FunctionDeclaration)
    }
  ]
}
```

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

**JSON representation**

```json
{
  "functionCallingConfig": {
    "mode": string,
    "allowedFunctionNames": [
      string
    ]
  }
}
```

## Resource: FunctionDeclaration

Defines a function that a model may call.

**Fields**

- **name**: string
  - Required. Name of the function.

- **description**: string
  - Optional. Description of the function.

- **parameters**: object ([Schema](./schema-reference.md#resource-schema))
  - Optional. Parameters that the function accepts.

**JSON representation**

```json
{
  "name": string,
  "description": string,
  "parameters": {
    object (Schema)
  }
}
```

## Resource: FunctionCall

Represents a call to a declared function.

**Fields**

- **id**: string
  - Optional. The unique id of the function call. If populated, the client to execute the functionCall and return the response with the matching id.

- **name**: string
  - Required. Name of the function.

- **args**: object (Struct format)
  - Optional. The function parameters and values in JSON object format.

**JSON representation**

```json
{
  "id": string,
  "name": string,
  "args": {
    object
  }
}
```

## Resource: FunctionResponse

Represents a response to a FunctionCall.

**Fields**

- **name**: string
  - Required. Name of the function called.

- **response**: object
  - Optional. Response from the function call.

**JSON representation**

```json
{
  "name": string,
  "response": {
    object
  }
}
```

## JavaScript Usage Examples

### Declaring Functions

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

// Define a weather function
const weatherFunction = {
  name: "getCurrentWeather",
  description: "Get the current weather in a given location",
  parameters: {
    type: "OBJECT",
    properties: {
      location: {
        type: "STRING",
        description: "The city and state, e.g., San Francisco, CA"
      },
      unit: {
        type: "STRING",
        enum: ["celsius", "fahrenheit"],
        description: "The temperature unit to use"
      }
    },
    required: ["location"]
  }
};

// Main function to query the model with a tool
async function askWithTool() {
  const model = ai.models.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [{
      functionDeclarations: [weatherFunction]
    }]
  });

  const result = await model.generateContent({
    contents: [{ text: "What's the weather like in Boston right now?" }],
    config: {
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTOMATIC"
        }
      }
    }
  });

  const response = result.response;
  console.log(JSON.stringify(response, null, 2));
}

askWithTool();
```

### Handling Function Calls

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

// Define a weather function
const weatherFunction = {
  name: "getCurrentWeather",
  description: "Get the current weather in a given location",
  parameters: {
    type: "OBJECT",
    properties: {
      location: {
        type: "STRING",
        description: "The city and state, e.g., San Francisco, CA"
      },
      unit: {
        type: "STRING",
        enum: ["celsius", "fahrenheit"],
        description: "The temperature unit to use"
      }
    },
    required: ["location"]
  }
};

// Mock function to get weather data
function getCurrentWeather(location, unit = "celsius") {
  console.log(`Getting weather for ${location} in ${unit}`);
  // In a real application, this would call a weather API
  return {
    location: location,
    temperature: unit === "celsius" ? 22 : 72,
    unit: unit,
    forecast: ["sunny", "windy"]
  };
}

// Main function to process function calls
async function processFunctionCalls() {
  const model = ai.models.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [{
      functionDeclarations: [weatherFunction]
    }]
  });

  const chat = model.startChat();
  
  const result = await chat.sendMessage("What's the weather like in Boston?");
  
  // Check if the model wants to call a function
  const functionCallPart = result.parts.find(part => part.functionCall);
  
  if (functionCallPart) {
    const functionCall = functionCallPart.functionCall;
    console.log("Function call:", functionCall);
    
    // Extract parameters
    const { location, unit = "celsius" } = functionCall.args;
    
    // Call the actual function
    const weatherData = getCurrentWeather(location, unit);
    
    // Send the function response back to the model
    const functionResponse = await chat.sendMessage({
      functionResponse: {
        name: functionCall.name,
        response: weatherData
      }
    });
    
    console.log("Final response:", functionResponse.text);
  } else {
    console.log("No function call needed:", result.text);
  }
}

processFunctionCalls();
```

### Restricting Function Calls

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "GEMINI_API_KEY" });

// Define multiple functions
const functions = [
  {
    name: "getCurrentWeather",
    description: "Get the current weather in a location",
    parameters: {
      type: "OBJECT",
      properties: {
        location: {
          type: "STRING",
          description: "The location for the weather"
        }
      },
      required: ["location"]
    }
  },
  {
    name: "getRestaurantRecommendation",
    description: "Find restaurant recommendations in an area",
    parameters: {
      type: "OBJECT",
      properties: {
        location: {
          type: "STRING",
          description: "The location for restaurant search"
        },
        cuisine: {
          type: "STRING",
          description: "Type of cuisine"
        }
      },
      required: ["location"]
    }
  }
];

// Main function with restricted function calling
async function restrictedFunctionCalling() {
  const model = ai.models.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [{
      functionDeclarations: functions
    }]
  });

  const result = await model.generateContent({
    contents: [{ text: "It's going to be hot today in Miami, suggest some restaurants with outdoor seating" }],
    config: {
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          // Only allow weather function, even though the prompt asks about restaurants
          allowedFunctionNames: ["getCurrentWeather"]
        }
      }
    }
  });

  console.log(JSON.stringify(result.response, null, 2));
}

restrictedFunctionCalling();
```