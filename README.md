# @metapages/dataref

**Encode any JavaScript type including TypedArrays into data URL strings for embedding in URL parameters, JSON, and more.**

Moving around large blobs of data is hard and complicated. Datarefs solve this by encoding complex binary types into compact, unambiguous string references that can be easily passed around your network, database, and URLs.

## Overview

This library uses **data URL strings** (e.g., `data:text/plain,hello`) to encode any JavaScript type including TypedArrays. Data URLs are unambiguous, URL-safe, and standards-based (RFC 2397).

**Note:** v1 (JSON object format) is maintained internally for backwards compatibility but is not exported. All public APIs use the modern v2 data URL format.

## Why Data URLs?

Data URL strings have several key advantages:

1. **Unambiguous**: A string starting with `data:` is clearly a dataref, not confused with regular data
2. **URL-safe**: Can be embedded directly in URL parameters without special handling
3. **JSON-safe**: When serialized to JSON, remains a simple string that's clearly identifiable
4. **Standards-based**: Uses the existing data URL standard (RFC 2397)
5. **Type preservation**: Supports all JavaScript types including TypedArrays with full type information

## Installation

```bash
npm install @metapages/dataref
```

## Quick Start

```typescript
import {
  textToDataUrl,
  jsonToDataUrl,
  bufferToDataUrl,
  typedArrayToDataUrl,
  dataUrlToText,
  dataUrlToJson,
  dataUrlToBuffer,
  dataUrlToTypedArray,
  dereferenceDataRefs,
} from "@metapages/dataref";

// Encode text to data URL
const textDataUrl = textToDataUrl("Hello, World!");
// => "data:text/plain;charset=utf-8,Hello%2C%20World!"

// Decode back to text
const text = await dataUrlToText(textDataUrl);
// => "Hello, World!"

// Encode JSON to data URL
const jsonDataUrl = jsonToDataUrl({ name: "John", age: 30 });
// => "data:application/json;charset=utf-8,%7B%22name%22%3A%22John%22%2C%22age%22%3A30%7D"

// Decode back to JSON
const data = await dataUrlToJson(jsonDataUrl);
// => { name: "John", age: 30 }

// Encode binary data
const buffer = new Uint8Array([1, 2, 3, 4, 5]);
const bufferDataUrl = bufferToDataUrl(buffer);
// => "data:application/octet-stream;base64,AQIDBAU="

// Encode TypedArrays with type preservation
const floatArray = new Float32Array([1.1, 2.2, 3.3]);
const arrayDataUrl = typedArrayToDataUrl(floatArray, "Float32Array");
// => "data:application/octet-stream;type=Float32Array;base64,..."

// Decode back to Float32Array
const decodedArray = await dataUrlToTypedArray<Float32Array>(arrayDataUrl);
// => Float32Array [1.1, 2.2, 3.3]
```

## Core Concepts

### Data URLs

A data URL is a URI scheme that allows you to embed data directly in a URL string. The format is:

```
data:[<mediatype>][;base64],<data>
```

Examples:
- Text: `data:text/plain,Hello`
- JSON: `data:application/json,{"key":"value"}`
- Binary: `data:application/octet-stream;base64,AQIDBA==`
- TypedArray: `data:application/octet-stream;type=Float32Array;base64,zcxMPw==`

### Supported Types

The library supports all JavaScript data types:

| Type | Encoding | Example |
|------|----------|---------|
| String | URL-encoded text | `textToDataUrl("hello")` |
| JSON | URL-encoded JSON | `jsonToDataUrl({key: "value"})` |
| ArrayBuffer | Base64 binary | `bufferToDataUrl(buffer)` |
| Uint8Array | Base64 binary | `bufferToDataUrl(uint8Array)` |
| TypedArrays | Base64 with type | `typedArrayToDataUrl(array, type)` |
| URL reference | URL-encoded URI | `urlToDataUrl("https://...")` |

**Supported TypedArray types:**
- `Int8Array`, `Uint8Array`, `Uint8ClampedArray`
- `Int16Array`, `Uint16Array`
- `Int32Array`, `Uint32Array`
- `BigInt64Array`, `BigUint64Array`
- `Float32Array`, `Float64Array`

## Advanced Usage

### Dereferencing DataRefs in JSON

The `dereferenceDataRefs()` function traverses a JSON object and automatically converts all data URL strings into their actual values:

```typescript
import { dereferenceDataRefs, textToDataUrl, jsonToDataUrl, typedArrayToDataUrl } from "@metapages/dataref";

// Create a complex object with embedded datarefs
const obj = {
  title: textToDataUrl("My Document"),
  metadata: jsonToDataUrl({ author: "Jane", version: 2 }),
  data: {
    values: typedArrayToDataUrl(new Float32Array([1.1, 2.2]), "Float32Array"),
    count: 42,
  },
  items: [
    "regular string",
    textToDataUrl("encoded text"),
    { nested: jsonToDataUrl({ deep: "value" }) }
  ]
};

// Dereference all datarefs at once
const resolved = await dereferenceDataRefs(obj);

// Result:
// {
//   title: "My Document",
//   metadata: { author: "Jane", version: 2 },
//   data: {
//     values: Float32Array [1.1, 2.2],
//     count: 42
//   },
//   items: [
//     "regular string",
//     "encoded text",
//     { nested: { deep: "value" } }
//   ]
// }
```

**Key features:**
- Recursively traverses objects and arrays
- Preserves non-dataref values unchanged
- Handles all data types (text, JSON, TypedArrays, ArrayBuffers)
- Processes multiple datarefs in parallel for performance
- Returns a new immutable object (uses `mutative` library)

### URL References

You can create datarefs that reference external URLs:

```typescript
import { urlToDataUrl, dataUrlToUrl } from "@metapages/dataref";

// Create a URL reference (without fetching)
const urlRef = await urlToDataUrl("https://example.com/data.json");
// => "data:text/x-uri;charset=utf-8,https%3A%2F%2Fexample.com%2Fdata.json"

// Extract the URL back
const url = dataUrlToUrl(urlRef);
// => "https://example.com/data.json"

// Create a URL reference AND fetch its content
const urlRefWithContent = await urlToDataUrl(
  "https://example.com/data.json",
  { headers: { "Authorization": "Bearer token" } }
);
// This will fetch the content and encode it as a data URL
```

### Validation

```typescript
import { isDataUrl, isUrlDataUrl, isDataRef } from "@metapages/dataref";

// Check if a value is a data URL
isDataUrl("data:text/plain,hello");  // true
isDataUrl("regular string");         // false

// Check if a data URL is a URL reference
isUrlDataUrl("data:text/x-uri,https%3A%2F%2Fexample.com");  // true
isUrlDataUrl("data:text/plain,hello");                       // false

// Check if a value is a dataref (includes backwards compatibility with v1 objects)
isDataRef("data:text/plain,hello");              // true
isDataRef({ ref: "utf8", value: "hello" });      // true (legacy v1 format)
isDataRef("regular string");                     // false
```

## API Reference

### Encoding Functions (to Data URL)

#### `textToDataUrl(text: string): DataUrl`
Converts a text string to a data URL.

```typescript
textToDataUrl("Hello, World!");
// => "data:text/plain;charset=utf-8,Hello%2C%20World!"
```

#### `jsonToDataUrl(data: unknown): DataUrl`
Converts any JSON-serializable data to a data URL.

```typescript
jsonToDataUrl({ name: "John", age: 30 });
// => "data:application/json;charset=utf-8,..."
```

#### `bufferToDataUrl(buffer: ArrayBuffer | Uint8Array): DataUrl`
Converts an ArrayBuffer or Uint8Array to a base64-encoded data URL.

```typescript
bufferToDataUrl(new Uint8Array([1, 2, 3]));
// => "data:application/octet-stream;base64,AQID"
```

#### `typedArrayToDataUrl<T>(array: TypedArray, type: TypedArrayType): DataUrl`
Converts a TypedArray to a data URL with type preservation.

```typescript
typedArrayToDataUrl(new Float32Array([1.1, 2.2]), "Float32Array");
// => "data:application/octet-stream;type=Float32Array;base64,..."
```

#### `urlToDataUrl(url: string, fetchOptions?: RequestInit): Promise<DataUrl>`
Creates a URL reference or fetches and encodes URL content.

```typescript
// Create reference only
await urlToDataUrl("https://example.com/data.json");

// Fetch and encode content
await urlToDataUrl("https://example.com/data.json", {
  headers: { "Authorization": "Bearer token" }
});
```

### Decoding Functions (from Data URL)

All decoding functions are async and support optional `fetchOptions` for URL-based datarefs.

#### `dataUrlToText(dataUrl: DataUrl, fetchOptions?: RequestInit): Promise<string>`
Decodes a data URL to a text string.

#### `dataUrlToJson<T>(dataUrl: DataUrl, fetchOptions?: RequestInit): Promise<T>`
Decodes a data URL to parsed JSON.

#### `dataUrlToBuffer(dataUrl: DataUrl, fetchOptions?: RequestInit): Promise<ArrayBuffer>`
Decodes a data URL to an ArrayBuffer.

#### `dataUrlToTypedArray<T>(dataUrl: DataUrl, fetchOptions?: RequestInit): Promise<T>`
Decodes a data URL to a TypedArray with type preservation.

#### `dataUrlToFile(dataUrl: DataUrl, name?: string, fetchOptions?: RequestInit): Promise<File>`
Converts a data URL to a File object.

```typescript
const file = await dataUrlToFile(dataUrl, "document.txt");
// => File { name: "document.txt", type: "text/plain", ... }
```

### Utility Functions

#### `dereferenceDataRefs<T>(json: T, fetchOptions?: RequestInit): Promise<T>`
Traverses a JSON object and dereferences all v2 data URLs.

#### `isDataUrl(value: unknown): boolean`
Checks if a value is a v2 data URL string.

#### `isUrlDataUrl(dataUrl: DataUrl): boolean`
Checks if a data URL is a URL reference.

#### `dataUrlToUrl(dataUrl: DataUrl): string | null`
Extracts the URL from a URL reference data URL.

#### `getMimeType(dataUrl: DataUrl): string`
Gets the MIME type from a data URL.

#### `getParameters(dataUrl: DataUrl): Record<string, string>`
Gets the parameters from a data URL header.

## Backwards Compatibility

The library maintains full backwards compatibility with the legacy v1 format (JSON objects). Legacy data and modern data URLs can coexist in the same application.

### Legacy v1 DataRef Format (Internal)

```typescript
type DataRef = {
  ref: "utf8" | "json" | "base64" | "url" | "key";
  value: any;
  contentType?: string;
  size?: number;
  sha256?: string;
  created?: string;
};
```

### Working with Legacy Data

The library automatically detects and handles legacy v1 format (JSON objects) for backwards compatibility:

```typescript
import { isDataRef, dereferenceDataRefs, textToDataUrl } from "@metapages/dataref";

// Legacy v1 format (internal, for reference only)
const legacyRef = {
  ref: "utf8",
  value: "Hello from legacy data"
};

// Modern data URL format
const modernRef = textToDataUrl("Hello from modern data");

// Both are recognized by isDataRef
isDataRef(legacyRef);  // true
isDataRef(modernRef);  // true

// Can coexist in the same structure
const mixed = {
  oldData: legacyRef,
  newData: modernRef
};

// dereferenceDataRefs only processes data URLs, leaves legacy objects unchanged
const result = await dereferenceDataRefs(mixed);
// {
//   oldData: { ref: "utf8", value: "Hello from legacy data" },  // unchanged
//   newData: "Hello from modern data"                            // dereferenced
// }
```

### Migrating Legacy Data

If you have legacy v1 datarefs in your system, here's how to convert them to modern data URLs:

```typescript
import { textToDataUrl, jsonToDataUrl, bufferToDataUrl, urlToDataUrl } from "@metapages/dataref";

// v1 DataRef type (for reference)
type DataRef = {
  ref: "utf8" | "json" | "base64" | "url" | "key";
  value: any;
};

function v1ToV2(v1Ref: DataRef): string | Promise<string> {
  switch (v1Ref.ref) {
    case "utf8":
      return textToDataUrl(v1Ref.value as string);

    case "json":
      return jsonToDataUrl(v1Ref.value);

    case "base64": {
      // Decode base64 to binary first
      const binaryString = atob(v1Ref.value as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bufferToDataUrl(bytes);
    }

    case "url":
      // URL refs need to be handled with urlToDataUrl
      return urlToDataUrl(v1Ref.value as string);

    default:
      throw new Error(`Unknown v1 DataRef type: ${v1Ref.ref}`);
  }
}

// Example migration
const v1Data: DataRef = {
  ref: "json",
  value: { name: "John", age: 30 }
};

const v2Data = v1ToV2(v1Data);
// => "data:application/json;charset=utf-8,..."
```

## Use Cases

### 1. Embedding Binary Data in URLs

```typescript
// Encode an image or binary file into a data URL
const imageBuffer = await fetch("/image.png").then(r => r.arrayBuffer());
const imageDataUrl = bufferToDataUrl(imageBuffer);

// Use in URL parameter
const url = `https://app.example.com?image=${encodeURIComponent(imageDataUrl)}`;
```

### 2. Storing Complex Data in JSON

```typescript
// Store TypedArrays in JSON
const data = {
  metadata: { name: "sensor-data" },
  readings: typedArrayToDataUrl(new Float32Array([1.1, 2.2, 3.3]), "Float32Array")
};

const json = JSON.stringify(data);
// Can be stored in database, sent over network, etc.

// Later, restore the TypedArray
const restored = JSON.parse(json);
const readings = await dataUrlToTypedArray<Float32Array>(restored.readings);
```

### 3. API Responses with Embedded Data

```typescript
// Server response with embedded binary data
const apiResponse = {
  status: "success",
  document: {
    title: textToDataUrl("My Document"),
    content: textToDataUrl("Document content..."),
    thumbnail: bufferToDataUrl(thumbnailBuffer)
  }
};

// Client can dereference all at once
const resolved = await dereferenceDataRefs(apiResponse);
// All datarefs are now actual values
```

### 4. Browser File Handling

```typescript
// Convert File to data URL for transmission
const file = document.querySelector('input[type="file"]').files[0];
const dataUrl = await fileToDataUrl(file);

// Send to API as JSON
await fetch("/api/upload", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ file: dataUrl })
});

// On server, convert back to File
const receivedFile = await dataUrlToFile(dataUrl, "uploaded-file");
```

## Performance Considerations

- **Parallel dereferencing**: `dereferenceDataRefs()` processes all datarefs in parallel using `Promise.all()`
- **Immutable updates**: Uses the `mutative` library for efficient immutable updates
- **Lazy evaluation**: Datarefs are only decoded when needed
- **Memory efficient**: Data URLs are strings, easier to serialize and cache than binary Blob objects

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { DataUrl, TypedArrayType, DataRefTypedArray } from "@metapages/dataref";

// Type-safe TypedArray handling
const array = new Float32Array([1, 2, 3]);
const dataUrl = typedArrayToDataUrl(array, "Float32Array");
const decoded = await dataUrlToTypedArray<Float32Array>(dataUrl);

// Type inference with JSON
interface User {
  name: string;
  age: number;
}

const userDataUrl = jsonToDataUrl<User>({ name: "John", age: 30 });
const user = await dataUrlToJson<User>(userDataUrl);
```

## Testing

The library includes comprehensive test coverage:

- 38 tests for v2 basic type conversions
- 11 tests for `dereferenceDataRefs()` functionality
- 13 tests for v1/v2 backwards compatibility
- All 56 tests passing

Run tests:
```bash
npm test
```

## Browser Support

Works in all modern browsers that support:
- `TextEncoder`/`TextDecoder`
- `atob`/`btoa`
- `crypto.subtle` (for file hashing)
- `fetch` API (for URL-based datarefs)

## License

See LICENSE file.

## Contributing

Contributions welcome! Please ensure all tests pass and add tests for new features.

## LLM/AI Model Usage Guide

**For AI models processing this library:**

1. **Import from main package**: Always import from `@metapages/dataref` (no v1/v2 subpaths)
2. **Use data URL format**: All encoding functions return data URL strings (e.g., `data:text/plain,hello`)
3. **Type preservation**: Use `typedArrayToDataUrl()` with the type parameter for TypedArrays
4. **Dereferencing**: Use `dereferenceDataRefs()` to process entire JSON structures at once
5. **Validation**: Check with `isDataUrl()` before decoding
6. **Error handling**: All decoding functions are async and may throw errors for invalid data URLs
7. **Legacy support**: `isDataRef()` detects both modern data URLs and legacy v1 objects

**Common patterns:**

```typescript
// Pattern 1: Encode and embed in JSON
import { textToDataUrl, bufferToDataUrl, typedArrayToDataUrl } from "@metapages/dataref";

const data = {
  text: textToDataUrl("value"),
  binary: bufferToDataUrl(buffer),
  array: typedArrayToDataUrl(array, "Float32Array")
};

// Pattern 2: Batch decode
import { dereferenceDataRefs } from "@metapages/dataref";

const decoded = await dereferenceDataRefs(data);

// Pattern 3: Type-safe decoding
import { isDataUrl, dataUrlToJson } from "@metapages/dataref";

if (isDataUrl(value)) {
  const result = await dataUrlToJson<MyType>(value);
}

// Pattern 4: Migration from legacy format
import { textToDataUrl, jsonToDataUrl } from "@metapages/dataref";

const modernRef = legacyRef.ref === "utf8"
  ? textToDataUrl(legacyRef.value)
  : jsonToDataUrl(legacyRef.value);
```
