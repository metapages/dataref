# @metapages/dataref

**Encode any JavaScript type including TypedArrays into data URL strings for embedding in URL parameters, shrinking JSON, and more.**

## The Problem

You need to pass binary data (TypedArrays, ArrayBuffers) through JSON, URLs, or databases but they don't serialize, or they are too large. 

```typescript
// This doesn't work:
JSON.stringify({ readings: new Float32Array([1.1, 2.2, 3.3]) });
// => '{"readings":{}}'  😞
```

And when your data gets large, you can't just inline it everywhere. A 50MB sensor dataset embedded in JSON clogs up your database, message queues, and API responses.

## The Solution

Dataref solves both problems:

**1. Inline encoding** for small data—encodes complex types into data URL strings that serialize cleanly:

```typescript
import { typedArrayToDataUrl, dereferenceDataRefs } from "@metapages/dataref";

// Encode complex data into a JSON-safe structure
const packet = {
  metadata: { version: 2, format: "sensor" },
  readings: typedArrayToDataUrl(new Float32Array([1.1, 2.2, 3.3]), "Float32Array"),
};

// Safe to serialize, store, transmit as JSON
const json = JSON.stringify(packet);  // Works! ✓

// Later, decode everything at once
const restored = await dereferenceDataRefs(JSON.parse(json));
// restored.readings => Float32Array [1.1, 2.2, 3.3]  ✓
```

**2. Cloud upload** for large data—automatically uploads big values to your storage, keeping JSON small:

```typescript
import { convertLargeObjectsToDataRefs, dereferenceDataRefs } from "@metapages/dataref";

const data = {
  metadata: { version: 2 },
  hugeDataset: new Array(100000).fill({ x: 1, y: 2 }),  // 2MB+ of data
};

// Upload large values to cloud, replace with URL references
const compact = await convertLargeObjectsToDataRefs(data, 10240, async (blob, type) => {
  const { url } = await fetch("/api/upload", { method: "POST", body: blob }).then(r => r.json());
  return url;
});
// compact.hugeDataset => "data:text/x-uri;type=array,https://storage.example.com/abc123"

// JSON is now tiny—safe for databases, message queues, API responses
await db.save(compact);

// Later, fetch and decode everything automatically
const restored = await dereferenceDataRefs(await db.load());
// restored.hugeDataset => the full 100,000 element array
```

| Input | Encoded Data URL | Decoded Output |
|-------|------------------|----------------|
| `"Hello"` | `data:text/plain;charset=utf-8,Hello` | `"Hello"` |
| `{ key: "value" }` | `data:application/json;charset=utf-8,...` | `{ key: "value" }` |
| `new Uint8Array([1,2,3])` | `data:application/octet-stream;base64,AQID` | `ArrayBuffer` |
| `new Float32Array([1.1])` | `data:...;type=Float32Array;base64,...` | `Float32Array [1.1]` |
| Large blob (uploaded) | `data:text/x-uri,https://...` | Original data (fetched) |

## Why Data URLs?

1. **Unambiguous**: A string starting with `data:` is clearly a dataref, not confused with regular data
2. **JSON-safe**: Serializes as a simple string, deserializes perfectly
3. **URL-safe**: Can be embedded directly in URL parameters
4. **Type preservation**: TypedArrays decode to the correct type, not just ArrayBuffer
5. **Standards-based**: Uses the existing data URL standard (RFC 2397)

**Note:** v1 (JSON object format) is maintained internally for backwards compatibility but is not exported. All public APIs use the modern v2 data URL format.

## Installation

```bash
npm install @metapages/dataref
```

## Quick Start

### Primary API (Recommended)

The simplest way to work with binary data in JSON is to use the primary serialize/deserialize functions:

```typescript
import { serializeDataRefs, deserializeDataRefs } from "@metapages/dataref";

// Automatically converts ALL binary types to datarefs
const data = {
  uint8: new Uint8Array([1, 2, 3]),
  float32: new Float32Array([1.1, 2.2, 3.3]),
  buffer: new Uint8Array([255, 128, 0]).buffer,
  blob: new Blob(["hello"], { type: "text/plain" }),
  file: new File(["content"], "test.txt"),
  string: "regular data",
  nested: {
    array: new Int16Array([100, -100])
  }
};

// Serialize: Convert all binary types to dataref strings
const serialized = await serializeDataRefs(data);
// All binary types are now dataref strings, safe for JSON.stringify()

// Store or transmit
const json = JSON.stringify(serialized);

// Deserialize: Convert all datarefs back to original types
const deserialized = await deserializeDataRefs(JSON.parse(json));
// All binary types are restored to their original types
```

**With upload/download support for large objects:**

```typescript
// Serialize with upload for large data
const serialized = await serializeDataRefs(data, {
  uploadFn: async (data, metadata) => {
    // Upload to your storage service
    const response = await fetch("/upload", {
      method: "POST",
      body: data
    });
    const { url } = await response.json();
    return url;
  },
  maxSizeBytes: 10240 // Upload objects > 10KB
});

// Deserialize with custom download
const deserialized = await deserializeDataRefs(serialized, {
  downloadFn: async (url) => {
    const response = await fetch(url);
    return response.arrayBuffer();
  }
});
```

**What gets converted:**
- ✅ All TypedArray types (Int8Array, Uint8Array, Float32Array, etc.)
- ✅ ArrayBuffer
- ✅ Blob (with MIME type preservation)
- ✅ File (with name preservation)
- ❌ Regular data (strings, numbers, objects, arrays) — unchanged

### The Core Workflow: Encode → Serialize → Decode

The most common use case is encoding complex data for JSON serialization, then decoding it later:

```typescript
import {
  jsonToDataUrl,
  typedArrayToDataUrl,
  dereferenceDataRefs,
} from "@metapages/dataref";

// 1. Encode complex data into a JSON-safe structure
const packet = {
  metadata: jsonToDataUrl({ version: 2, format: "sensor" }),
  readings: typedArrayToDataUrl(new Float32Array([1.1, 2.2, 3.3]), "Float32Array"),
  label: "regular string stays as-is"
};

// 2. Safe to serialize, store, transmit as JSON
const json = JSON.stringify(packet);  // Works!

// 3. Later, decode everything at once with dereferenceDataRefs
const loaded = JSON.parse(json);
const restored = await dereferenceDataRefs(loaded);
// restored.metadata → { version: 2, format: "sensor" }
// restored.readings → Float32Array [1.1, 2.2, 3.3]
// restored.label → "regular string stays as-is"
```

`dereferenceDataRefs()` recursively traverses your JSON and decodes all data URLs in a single call. Non-dataref values pass through unchanged.

### Individual Encode/Decode Functions

For encoding and decoding individual values:

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
} from "@metapages/dataref";

// Text
const textDataUrl = textToDataUrl("Hello, World!");
const text = await dataUrlToText(textDataUrl);  // "Hello, World!"

// JSON
const jsonDataUrl = jsonToDataUrl({ name: "John", age: 30 });
const data = await dataUrlToJson(jsonDataUrl);  // { name: "John", age: 30 }

// Binary (ArrayBuffer/Uint8Array)
const bufferDataUrl = bufferToDataUrl(new Uint8Array([1, 2, 3, 4, 5]));
const buffer = await dataUrlToBuffer(bufferDataUrl);  // ArrayBuffer

// TypedArrays with type preservation
const arrayDataUrl = typedArrayToDataUrl(new Float32Array([1.1, 2.2]), "Float32Array");
const array = await dataUrlToTypedArray<Float32Array>(arrayDataUrl);  // Float32Array [1.1, 2.2]
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
| Blob | Base64 with MIME type | `blobToDataUrl(blob)` |
| File | Base64 with name | `fileToDataUrl(file)` |
| URL reference | URL-encoded URI | `urlToDataUrl("https://...")` |

**Supported TypedArray types:**
- `Int8Array`, `Uint8Array`, `Uint8ClampedArray`
- `Int16Array`, `Uint16Array`
- `Int32Array`, `Uint32Array`
- `BigInt64Array`, `BigUint64Array`
- `Float32Array`, `Float64Array`

## Advanced Usage

### Converting Large Objects to DataRefs

The `convertLargeObjectsToDataRefs()` function is the inverse of `dereferenceDataRefs()`. It traverses a JSON object and uploads large values to a storage service, replacing them with URL-based datarefs:

```typescript
import { convertLargeObjectsToDataRefs } from "@metapages/dataref";

// Mock upload function that returns a URL for stored data
async function uploadToStorage(data: string, originalType: string): Promise<string> {
  // Upload data to your storage service (S3, Cloud Storage, etc.)
  const response = await fetch("https://api.example.com/upload", {
    method: "POST",
    body: data,
    headers: { "Content-Type": "application/json" }
  });
  const { url } = await response.json();
  return url;
}

const largeData = {
  metadata: { version: 1, created: new Date() },
  hugeDataset: {
    description: "Large dataset",
    values: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() }))
  },
  smallValue: "This stays inline"
};

// Convert objects larger than 10KB to URL-based datarefs
const optimized = await convertLargeObjectsToDataRefs(
  largeData,
  10240, // 10KB threshold
  uploadToStorage
);

// Result:
// {
//   metadata: { version: 1, created: ... },
//   hugeDataset: "data:text/x-uri;type=object;charset=utf-8,https%3A%2F%2F...",
//   smallValue: "This stays inline"
// }
```

**How it works:**
1. Traverses the JSON object recursively
2. Calculates the serialized size of each value
3. If a value exceeds `maxSizeBytes`, calls your upload function
4. Replaces the large value with a URL-based dataref that preserves type information
5. Small values remain unchanged for efficiency

**Key features:**
- Uploads large objects in parallel for performance
- Preserves original type information in the dataref
- Uses SHA-256 hashing for content-addressable storage
- Returns a new immutable object
- Works with any storage backend (S3, Azure, Google Cloud, custom API)

**Round-trip example:**

```typescript
// Step 1: Convert large objects to refs
const withRefs = await convertLargeObjectsToDataRefs(
  originalData,
  5000, // 5KB threshold
  uploadToS3
);

// Store or transmit the optimized data (much smaller)
await database.save(withRefs);

// Step 2: Later, retrieve and dereference
const retrieved = await database.load();

// Create a custom fetch function for dereferencing
const customFetch = async (url: string) => {
  const response = await fetch(url);
  return response.arrayBuffer();
};

const restored = await dereferenceDataRefs(retrieved, {
  // Custom fetch can add auth headers, handle errors, etc.
});
// restored now contains the original large objects
```

**Use cases:**
- Storing large datasets in databases without hitting size limits
- Optimizing API payloads by offloading large objects to CDN
- Implementing client-side caching with overflow to IndexedDB/localStorage
- Building content-addressable storage systems
- Reducing memory usage when working with large JSON structures

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

### Primary Functions (Recommended)

#### `serializeDataRefs<T>(json: T, options?: SerializeOptions): Promise<T>`

Primary serialize function that automatically converts all binary types in a JSON object to dataref strings.

**Converts:**
- TypedArrays (Int8Array, Uint8Array, Float32Array, etc.) → dataref strings
- ArrayBuffer → dataref strings
- Blob → dataref strings (with MIME type preservation)
- File → dataref strings (with name preservation)
- Regular data (strings, numbers, objects, arrays) → unchanged

**Options:**
```typescript
interface SerializeOptions {
  uploadFn?: (data: Blob | ArrayBuffer, metadata: {
    type: string;
    size: number;
    mimeType?: string;
  }) => Promise<string>;
  maxSizeBytes?: number; // If provided, objects > size get uploaded
}
```

**Example:**
```typescript
const serialized = await serializeDataRefs({
  array: new Uint8Array([1, 2, 3]),
  blob: new Blob(["test"], { type: "text/plain" }),
  string: "unchanged"
});
```

**With upload:**
```typescript
const serialized = await serializeDataRefs(data, {
  uploadFn: async (data, metadata) => {
    // Upload and return URL
    return "https://storage.example.com/...";
  },
  maxSizeBytes: 10240 // Upload if > 10KB
});
```

#### `deserializeDataRefs<T>(json: T, options?: DeserializeOptions): Promise<T>`

Primary deserialize function that converts all dataref strings in a JSON object back to their original binary types.

**Options:**
```typescript
interface DeserializeOptions {
  fetchOptions?: RequestInit; // For URL-based datarefs
  downloadFn?: (url: string) => Promise<ArrayBuffer>; // Custom download
}
```

**Example:**
```typescript
const deserialized = await deserializeDataRefs(serialized);
// All datarefs are converted back to original types
```

**With custom download:**
```typescript
const deserialized = await deserializeDataRefs(serialized, {
  downloadFn: async (url) => {
    const response = await fetch(url, {
      headers: { "Authorization": "Bearer token" }
    });
    return response.arrayBuffer();
  }
});
```

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

#### `blobToDataUrl(blob: Blob): Promise<DataUrl>`
Converts a Blob to a data URL with MIME type preservation.

```typescript
const blob = new Blob(["content"], { type: "text/plain" });
await blobToDataUrl(blob);
// => "data:text/plain;type=Blob;base64,..."
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

#### `dataUrlToBlob(dataUrl: DataUrl, fetchOptions?: RequestInit): Promise<Blob>`
Decodes a data URL to a Blob with MIME type preservation.

```typescript
const blob = await dataUrlToBlob(dataUrl);
// => Blob { type: "text/plain", size: 7, ... }
```

#### `dataUrlToFile(dataUrl: DataUrl, name?: string, fetchOptions?: RequestInit): Promise<File>`
Converts a data URL to a File object.

```typescript
const file = await dataUrlToFile(dataUrl, "document.txt");
// => File { name: "document.txt", type: "text/plain", ... }
```

### Utility Functions

#### `convertLargeObjectsToDataRefs<T>(json: T, maxSizeBytes: number, uploadFn: (data: string, originalType: string) => Promise<string>): Promise<T>`
Traverses a JSON object and converts large values to URL-based datarefs.

**Parameters:**
- `json`: The JSON object to process
- `maxSizeBytes`: Size threshold in bytes (objects larger than this are uploaded)
- `uploadFn`: Async function that receives serialized data and type, returns a URL

**Returns:** New JSON object with large values replaced by URL-based datarefs

```typescript
const result = await convertLargeObjectsToDataRefs(
  myData,
  10240, // 10KB threshold
  async (data, type) => {
    const response = await fetch("/upload", { method: "POST", body: data });
    return (await response.json()).url;
  }
);
```

#### `dereferenceDataRefs<T>(json: T, fetchOptions?: RequestInit): Promise<T>`
Traverses a JSON object and dereferences all data URLs to their actual values.

**Parameters:**
- `json`: The JSON object containing datarefs
- `fetchOptions`: Optional fetch options for URL-based datarefs

**Returns:** New JSON object with all datarefs resolved

#### `isDataUrl(value: unknown): boolean`
Checks if a value is a data URL string.

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

### Development

This project uses [just](https://github.com/casey/just) as a command runner. Available commands:

```bash
just build          # Build the library
just test           # Run tests
just dev            # Watch mode for development
just check          # TypeScript type checking
```

### Publishing

Publishing to npm is automated via GitHub Actions:

1. **Bump the version:**
   ```bash
   just version patch   # For bug fixes (2.0.0 -> 2.0.1)
   just version minor   # For new features (2.0.0 -> 2.1.0)
   just version major   # For breaking changes (2.0.0 -> 3.0.0)
   ```

2. **Push to trigger publish:**
   ```bash
   just push-version    # Push commits and tags to GitHub
   ```

The GitHub Actions workflow will automatically:
- Build the package
- Run tests
- Publish to npm (if version doesn't already exist)
- Use npm provenance for supply chain security

**Note:** This project uses npm's Trusted Publishing with OIDC - no secrets required!

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
