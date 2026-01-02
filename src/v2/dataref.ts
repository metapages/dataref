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
  return `data:${MIME_TYPES.TEXT};charset=utf-8,${encoded}`;
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
 * Attempts to parse as JSON first, falls back to text, then buffer.
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

  // Handle different MIME types appropriately
  if (mimeType === MIME_TYPES.JSON) {
    return dataUrlToJson(dataUrl, fetchOptions);
  } else if (mimeType === MIME_TYPES.TEXT) {
    return dataUrlToText(dataUrl, fetchOptions);
  } else if (mimeType === MIME_TYPES.OCTET_STREAM && params.type) {
    // This is a typed array
    return dataUrlToTypedArray(dataUrl, fetchOptions);
  } else {
    // For octet-stream and other binary types, return as ArrayBuffer
    return dataUrlToBuffer(dataUrl, fetchOptions);
  }
};
