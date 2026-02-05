import {
  type DataUrl,
  MIME_TYPES,
  type TypedArrayType,
  type DataRefTypedArray,
} from "./types";

// Utility functions for data URL handling
export const isDataUrl = (value: unknown): value is DataUrl => {
  return typeof value === "string" && value.startsWith("data:");
};

export const getMimeType = (dataUrl: DataUrl): string => {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? match[1] : MIME_TYPES.OCTET_STREAM;
};

export const getParameters = (dataUrl: DataUrl): Record<string, string> => {
  const params: Record<string, string> = {};
  const paramString = dataUrl.match(/^data:[^;]+;([^,]+),/)?.[1];
  if (paramString) {
    paramString.split(";").forEach((param) => {
      const [key, value] = param.split("=");
      if (key && value) params[key] = value;
    });
  }
  return params;
};

// Core conversion functions
export const textToDataUrl = (text: string): DataUrl => {
  const encoded = encodeURIComponent(text);
  // TEMPORARY BREAK: Return broken format to test CI/CD
  return `BROKEN:${MIME_TYPES.TEXT};charset=utf-8,${encoded}`;
};

export const jsonToDataUrl = (data: unknown): DataUrl => {
  const jsonString = JSON.stringify(data);
  const encoded = encodeURIComponent(jsonString);
  return `data:${MIME_TYPES.JSON};charset=utf-8,${encoded}`;
};

export const bufferToDataUrl = (buffer: ArrayBuffer | Uint8Array): DataUrl => {
  const bytes = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:${MIME_TYPES.OCTET_STREAM};base64,${base64}`;
};

export const typedArrayToDataUrl = <T extends TypedArrayType>(
  array: InstanceType<(typeof globalThis)[T]>,
  type: T
): DataUrl => {
  const buffer = array.buffer;
  const bytes = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:${MIME_TYPES.TYPED_ARRAY}${type};base64,${base64}`;
};

export const blobToDataUrl = async (blob: Blob): Promise<DataUrl> => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...bytes));
  const mimeType = blob.type || MIME_TYPES.OCTET_STREAM;
  return `data:${mimeType};base64,${base64}`;
};

// Update core conversion functions to handle URLs
export const dataUrlToBuffer = async (
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<ArrayBuffer> => {
  // If it's a URL data URL, fetch the content first
  if (isUrlDataUrl(dataUrl)) {
    const url = dataUrlToUrl(dataUrl);
    if (!url) {
      throw new Error("Invalid URL data URL");
    }
    const response = await fetch(url, { ...fetchOptions, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  // Parse the data URL
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL format");
  }

  const header = dataUrl.substring(0, commaIndex);
  const data = dataUrl.substring(commaIndex + 1);

  // Check if it's base64 encoded
  const isBase64 = header.includes(";base64");

  if (isBase64) {
    // Handle base64-encoded data (including empty strings)
    if (!data) {
      return new ArrayBuffer(0);
    }
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } else {
    // Handle URL-encoded data (for text/JSON, including empty strings)
    const decodedString = data ? decodeURIComponent(data) : "";
    const encoder = new TextEncoder();
    return encoder.encode(decodedString).buffer;
  }
};

export const dataUrlToText = async (
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<string> => {
  const buffer = await dataUrlToBuffer(dataUrl, fetchOptions);
  return new TextDecoder().decode(buffer);
};

export const dataUrlToJson = async <T = unknown>(
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<T> => {
  const text = await dataUrlToText(dataUrl, fetchOptions);
  return JSON.parse(text);
};

export const dataUrlToTypedArray = async <T extends DataRefTypedArray>(
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<T> => {
  const params = getParameters(dataUrl);
  const arrayType = params.type as TypedArrayType;

  if (!arrayType) {
    throw new Error("Data URL does not contain type parameter");
  }

  const buffer = await dataUrlToBuffer(dataUrl, fetchOptions);
  const TypedArray = globalThis[arrayType];
  return new TypedArray(buffer) as T;
};

export const dataUrlToBlob = async (
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<Blob> => {
  const mimeType = getMimeType(dataUrl);
  const buffer = await dataUrlToBuffer(dataUrl, fetchOptions);
  return new Blob([buffer], { type: mimeType });
};

// Update file handling to use async buffer conversion
export const dataUrlToFile = async (
  dataUrl: DataUrl,
  name?: string,
  fetchOptions?: RequestInit
): Promise<File> => {
  const mimeType = getMimeType(dataUrl);
  const buffer = await dataUrlToBuffer(dataUrl, fetchOptions);

  if (!name) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    name = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  return new File([buffer], name, { type: mimeType });
};

// URL handling functions
export const urlToDataUrl = async (
  url: string,
  fetchOptions?: RequestInit
): Promise<DataUrl> => {
  // First encode the URL itself as a data URL with our custom MIME type
  const urlDataUrl = `data:${MIME_TYPES.URI};charset=utf-8,${encodeURIComponent(
    url
  )}`;

  // If fetchOptions are provided, we'll also fetch and encode the content
  if (fetchOptions) {
    const response = await fetch(url, { ...fetchOptions, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return bufferToDataUrl(buffer);
  }

  return urlDataUrl;
};

export const dataUrlToUrl = (dataUrl: DataUrl): string | null => {
  const mimeType = getMimeType(dataUrl);
  if (mimeType !== MIME_TYPES.URI) {
    return null;
  }
  return decodeURIComponent(dataUrl.split(",")[1]);
};

export const isUrlDataUrl = (dataUrl: DataUrl): boolean => {
  return getMimeType(dataUrl) === MIME_TYPES.URI;
};

// Update fileToDataUrl to handle URLs
export const fileToDataUrl = async (
  file: File | string,
  fetchOptions?: RequestInit
): Promise<DataUrl> => {
  if (typeof file === "string") {
    // If it's a string, treat it as a URL
    return urlToDataUrl(file, fetchOptions);
  }
  // Otherwise treat it as a File
  const buffer = await file.arrayBuffer();
  return bufferToDataUrl(buffer);
};

// Helper function to fetch content from a data URL that contains a URL
export const fetchDataUrlContent = async (
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<DataUrl> => {
  const url = dataUrlToUrl(dataUrl);
  if (!url) {
    throw new Error("Data URL does not contain a URL reference");
  }
  return urlToDataUrl(url, fetchOptions);
};

// Import mutative for efficient JSON traversal and modification
import { create } from "mutative";
import type { SerializeOptions, DeserializeOptions } from "./types";

/**
 * Primary serialize function that converts all binary types in a JSON object to dataref strings.
 *
 * Automatically converts:
 * - TypedArrays (Int8Array, Uint8Array, Float32Array, etc.) → dataref strings
 * - ArrayBuffer → dataref strings
 * - Blob → dataref strings
 * - File → dataref strings
 * - Regular data (strings, numbers, objects, arrays) → unchanged
 *
 * If uploadFn and maxSizeBytes are provided, binary objects exceeding the size threshold
 * will be uploaded and replaced with URL-based datarefs.
 *
 * @param json - The JSON object to serialize
 * @param options - Optional configuration for upload behavior
 * @returns A new JSON object with binary types converted to datarefs
 */
export const serializeDataRefs = async <T = any>(
  json: T,
  options?: SerializeOptions
): Promise<T> => {
  const { uploadFn, maxSizeBytes } = options || {};

  // Track all async conversions
  const promises: Array<{
    path: (string | number)[];
    promise: Promise<string>;
  }> = [];

  // Helper to check if value is a binary type
  const isBinaryType = (value: any): boolean => {
    return (
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value) ||
      value instanceof Blob ||
      (typeof File !== "undefined" && value instanceof File)
    );
  };

  // Helper to get size of binary data
  const getBinarySize = (value: any): number => {
    if (value instanceof ArrayBuffer) {
      return value.byteLength;
    } else if (ArrayBuffer.isView(value)) {
      return value.byteLength;
    } else if (value instanceof Blob) {
      return value.size;
    }
    return 0;
  };

  // Helper to get type name for binary data
  const getBinaryTypeName = (value: any): string => {
    if (value instanceof File) return "File";
    if (value instanceof Blob) return "Blob";
    if (value instanceof ArrayBuffer) return "ArrayBuffer";
    if (ArrayBuffer.isView(value)) return value.constructor.name;
    return "unknown";
  };

  // Helper to convert binary to dataref string
  const convertBinaryToDataRef = async (value: any): Promise<string> => {
    if (value instanceof File) {
      return fileToDataUrl(value);
    } else if (value instanceof Blob) {
      // Add type=Blob parameter to distinguish from plain ArrayBuffer
      const dataUrl = await blobToDataUrl(value);
      // Insert type parameter after MIME type
      const commaIndex = dataUrl.indexOf(",");
      const header = dataUrl.substring(0, commaIndex);
      const data = dataUrl.substring(commaIndex);
      return `${header};type=Blob${data}`;
    } else if (value instanceof ArrayBuffer) {
      // Add type=ArrayBuffer parameter to distinguish from Blob
      const dataUrl = bufferToDataUrl(value);
      const commaIndex = dataUrl.indexOf(",");
      const header = dataUrl.substring(0, commaIndex);
      const data = dataUrl.substring(commaIndex);
      return `${header};type=ArrayBuffer${data}`;
    } else if (ArrayBuffer.isView(value)) {
      // Typed array
      const typeName = value.constructor.name as TypedArrayType;
      return typedArrayToDataUrl(value as any, typeName);
    }
    throw new Error(`Unsupported binary type: ${typeof value}`);
  };

  // Helper to upload binary data
  const uploadBinary = async (value: any): Promise<string> => {
    if (!uploadFn) {
      throw new Error("Upload function not provided");
    }

    const size = getBinarySize(value);
    const typeName = getBinaryTypeName(value);
    const mimeType = value instanceof Blob ? value.type : undefined;

    // Convert to Blob or ArrayBuffer for upload
    let uploadData: Blob | ArrayBuffer;
    if (value instanceof Blob) {
      uploadData = value;
    } else if (value instanceof ArrayBuffer) {
      uploadData = value;
    } else if (ArrayBuffer.isView(value)) {
      uploadData = value.buffer;
    } else {
      throw new Error(`Cannot upload type: ${typeName}`);
    }

    const url = await uploadFn(uploadData, { type: typeName, size, mimeType });

    // Create a URL-based dataref with type information
    const encodedUrl = encodeURIComponent(url);
    return `data:${MIME_TYPES.URI};type=${typeName}${mimeType ? `;mimeType=${mimeType}` : ""};charset=utf-8,${encodedUrl}`;
  };

  // Traverse and collect conversion promises
  const collectConversions = (obj: any, path: (string | number)[] = []) => {
    if (obj === null || obj === undefined) {
      return;
    }

    // Check if this is a binary type
    if (isBinaryType(obj)) {
      const size = getBinarySize(obj);
      let promise: Promise<string>;

      // Should we upload this?
      if (uploadFn && maxSizeBytes && size > maxSizeBytes) {
        promise = uploadBinary(obj);
      } else {
        promise = convertBinaryToDataRef(obj);
      }

      promises.push({ path: [...path], promise });
      return; // Don't traverse into binary types
    }

    // Don't process existing data URLs
    if (typeof obj === "string" && isDataUrl(obj)) {
      return;
    }

    // Check if this is a primitive type
    if (typeof obj !== "object") {
      return;
    }

    // Traverse children
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        collectConversions(item, [...path, index]);
      });
    } else {
      Object.keys(obj).forEach((key) => {
        collectConversions(obj[key], [...path, key]);
      });
    }
  };

  // First pass: collect all conversion promises
  collectConversions(json);

  // If nothing to convert, return original
  if (promises.length === 0) {
    return json;
  }

  // Wait for all conversions to complete
  const results = await Promise.all(promises.map((p) => p.promise));

  // Second pass: use mutative to update the JSON with datarefs
  return create(json, (draft: any) => {
    promises.forEach(({ path }, index) => {
      const dataRef = results[index];

      // Navigate to the parent and set the value
      let current = draft;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      const lastKey = path[path.length - 1];
      current[lastKey] = dataRef;
    });
  });
};

/**
 * Converts large objects in a JSON structure to data URL references.
 * Objects exceeding the size threshold are uploaded using the provided function
 * and replaced with URL-based datarefs that preserve type information.
 *
 * @param json - The JSON object to process
 * @param maxSizeBytes - Size threshold in bytes (objects larger than this are converted to refs)
 * @param uploadFn - Async function that takes serialized data and original type, returns a URL
 * @returns A new JSON object with large values replaced by data URL references
 */
export const convertLargeObjectsToDataRefs = async <T = any>(
  json: T,
  maxSizeBytes: number,
  uploadFn: (data: string, originalType: string) => Promise<string>
): Promise<T> => {
  // Track all promises for async uploads
  const promises: Array<{
    path: (string | number)[];
    promise: Promise<{ url: string; originalType: string }>;
  }> = [];

  // Helper to get size of a value
  const getSize = (value: any): number => {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  };

  // Helper to determine the type of value
  const getValueType = (value: any): string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (value instanceof Uint8Array) return "Uint8Array";
    if (value instanceof ArrayBuffer) return "ArrayBuffer";
    if (ArrayBuffer.isView(value)) {
      return value.constructor.name;
    }
    return typeof value;
  };

  // Helper function to traverse and collect upload promises
  const collectUploads = (obj: any, path: (string | number)[] = []) => {
    if (obj === null || obj === undefined) {
      return;
    }

    // Check if this is a primitive type
    if (typeof obj !== "object") {
      return;
    }

    // Don't process data URLs themselves
    if (typeof obj === "string" && isDataUrl(obj)) {
      return;
    }

    // Check size for both arrays and objects
    const size = getSize(obj);
    const isTooLarge = size > maxSizeBytes && path.length > 0;

    if (isTooLarge) {
      // This object/array is too large, upload it as a whole
      const originalType = getValueType(obj);
      const serialized = JSON.stringify(obj);
      const promise = uploadFn(serialized, originalType).then((url) => ({
        url,
        originalType,
      }));
      promises.push({ path: [...path], promise });
      return; // Don't traverse into this object/array further
    }

    // Object/array is not too large, traverse its children
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        collectUploads(item, [...path, index]);
      });
    } else {
      Object.keys(obj).forEach((key) => {
        collectUploads(obj[key], [...path, key]);
      });
    }
  };

  // First pass: collect all upload promises
  collectUploads(json);

  // If no large objects found, return original
  if (promises.length === 0) {
    return json;
  }

  // Wait for all uploads to complete
  const results = await Promise.all(promises.map((p) => p.promise));

  // Second pass: use mutative to update the JSON with URL datarefs
  return create(json, (draft: any) => {
    promises.forEach(({ path }, index) => {
      const { url, originalType } = results[index];

      // Create a data URL that references the uploaded URL
      // Include the original type as a parameter
      const encodedUrl = encodeURIComponent(url);
      const dataUrl = `data:${MIME_TYPES.URI};type=${originalType};charset=utf-8,${encodedUrl}`;

      // Navigate to the parent and set the value
      let current = draft;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      const lastKey = path[path.length - 1];
      current[lastKey] = dataUrl;
    });
  });
};

/**
 * Traverses a JSON object and converts any data ref strings (v2 data URLs)
 * into their dereferenced data. Returns a new JSON object with all datarefs resolved.
 *
 * @param json - The JSON object to traverse
 * @param fetchOptions - Optional fetch options for URL-based datarefs
 * @returns A new JSON object with all datarefs dereferenced
 */
export const dereferenceDataRefs = async <T = any>(
  json: T,
  fetchOptions?: RequestInit
): Promise<T> => {
  // Track all promises for async dereferencing
  const promises: Array<{
    path: (string | number)[];
    promise: Promise<any>;
  }> = [];

  // Helper function to traverse and collect promises
  const collectPromises = (obj: any, path: (string | number)[] = []) => {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === "string" && isDataUrl(obj)) {
      // Found a data URL, create a promise to dereference it
      const promise = dereferenceDataUrl(obj, fetchOptions);
      promises.push({ path: [...path], promise });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        collectPromises(item, [...path, index]);
      });
    } else if (typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        collectPromises(obj[key], [...path, key]);
      });
    }
  };

  // First pass: collect all promises
  collectPromises(json);

  // If no datarefs found, return original
  if (promises.length === 0) {
    return json;
  }

  // Wait for all promises to resolve
  const results = await Promise.all(promises.map((p) => p.promise));

  // Second pass: use mutative to update the JSON with resolved values
  return create(json, (draft: any) => {
    promises.forEach(({ path }, index) => {
      let current = draft;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      const lastKey = path[path.length - 1];
      current[lastKey] = results[index];
    });
  });
};

/**
 * Dereferences a single data URL to its actual value.
 * Determines the appropriate type based on MIME type and parameters.
 *
 * @param dataUrl - The data URL to dereference
 * @param fetchOptions - Optional fetch options for URL-based datarefs
 * @returns The dereferenced value
 */
const dereferenceDataUrl = async (
  dataUrl: DataUrl,
  fetchOptions?: RequestInit
): Promise<any> => {
  const mimeType = getMimeType(dataUrl);
  const params = getParameters(dataUrl);

  // Handle URL-based datarefs
  if (mimeType === MIME_TYPES.URI && params.type) {
    // This is an uploaded binary, download it first
    const url = dataUrlToUrl(dataUrl);
    if (!url) {
      throw new Error("Invalid URL dataref");
    }

    const response = await fetch(url, { ...fetchOptions, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    // Convert based on original type
    const typeName = params.type;
    const mimeTypeParam = params.mimeType;

    if (typeName === "Blob") {
      return new Blob([buffer], { type: mimeTypeParam || MIME_TYPES.OCTET_STREAM });
    } else if (typeName === "File") {
      const fileName = params.name || "downloaded-file";
      return new File([buffer], fileName, { type: mimeTypeParam || MIME_TYPES.OCTET_STREAM });
    } else if (typeName === "ArrayBuffer") {
      return buffer;
    } else {
      // TypedArray
      const TypedArray = globalThis[typeName as TypedArrayType];
      if (TypedArray) {
        return new TypedArray(buffer);
      }
      return buffer;
    }
  }

  // Check type parameter first (most specific)
  if (params.type === "ArrayBuffer") {
    // Explicitly marked as ArrayBuffer
    return dataUrlToBuffer(dataUrl, fetchOptions);
  } else if (params.type === "Blob") {
    // Explicitly marked as Blob
    return dataUrlToBlob(dataUrl, fetchOptions);
  } else if (params.type && mimeType === MIME_TYPES.OCTET_STREAM) {
    // This is a typed array
    return dataUrlToTypedArray(dataUrl, fetchOptions);
  }

  // Then handle MIME types
  if (mimeType === MIME_TYPES.JSON) {
    return dataUrlToJson(dataUrl, fetchOptions);
  } else if (mimeType === MIME_TYPES.TEXT) {
    return dataUrlToText(dataUrl, fetchOptions);
  } else if (mimeType === MIME_TYPES.OCTET_STREAM) {
    // Plain ArrayBuffer (no type parameter)
    return dataUrlToBuffer(dataUrl, fetchOptions);
  } else {
    // For other binary types, return as ArrayBuffer by default
    return dataUrlToBuffer(dataUrl, fetchOptions);
  }
};

/**
 * Primary deserialize function that converts all dataref strings in a JSON object
 * back to their original binary types.
 *
 * Alias for dereferenceDataRefs with support for custom download function.
 *
 * @param json - The JSON object to deserialize
 * @param options - Optional configuration for fetch/download behavior
 * @returns A new JSON object with all datarefs converted back to original types
 */
export const deserializeDataRefs = async <T = any>(
  json: T,
  options?: DeserializeOptions
): Promise<T> => {
  const { fetchOptions, downloadFn } = options || {};

  // If custom download function provided, we need to handle it differently
  if (downloadFn) {
    // Track all promises for async dereferencing
    const promises: Array<{
      path: (string | number)[];
      promise: Promise<any>;
    }> = [];

    // Helper function to traverse and collect promises
    const collectPromises = (obj: any, path: (string | number)[] = []) => {
      if (obj === null || obj === undefined) {
        return;
      }

      if (typeof obj === "string" && isDataUrl(obj)) {
        // Check if this is a URL dataref
        if (isUrlDataUrl(obj)) {
          const url = dataUrlToUrl(obj);
          const params = getParameters(obj);
          if (url) {
            // Use custom download function
            const promise = downloadFn(url).then((buffer) => {
              // Convert based on original type
              const typeName = params.type;
              const mimeTypeParam = params.mimeType;

              if (typeName === "Blob") {
                return new Blob([buffer], { type: mimeTypeParam || MIME_TYPES.OCTET_STREAM });
              } else if (typeName === "File") {
                const fileName = params.name || "downloaded-file";
                return new File([buffer], fileName, { type: mimeTypeParam || MIME_TYPES.OCTET_STREAM });
              } else if (typeName === "ArrayBuffer") {
                return buffer;
              } else {
                // TypedArray
                const TypedArray = globalThis[typeName as TypedArrayType];
                if (TypedArray) {
                  return new TypedArray(buffer);
                }
                return buffer;
              }
            });
            promises.push({ path: [...path], promise });
            return;
          }
        }
        // Regular dataref, use normal dereferencing
        const promise = dereferenceDataUrl(obj, fetchOptions);
        promises.push({ path: [...path], promise });
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          collectPromises(item, [...path, index]);
        });
      } else if (typeof obj === "object") {
        Object.keys(obj).forEach((key) => {
          collectPromises(obj[key], [...path, key]);
        });
      }
    };

    // First pass: collect all promises
    collectPromises(json);

    // If no datarefs found, return original
    if (promises.length === 0) {
      return json;
    }

    // Wait for all promises to resolve
    const results = await Promise.all(promises.map((p) => p.promise));

    // Second pass: use mutative to update the JSON with resolved values
    return create(json, (draft: any) => {
      promises.forEach(({ path }, index) => {
        let current = draft;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }
        const lastKey = path[path.length - 1];
        current[lastKey] = results[index];
      });
    });
  }

  // No custom download function, use default dereferencing
  return dereferenceDataRefs(json, fetchOptions);
};
