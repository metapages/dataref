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

  // Handle regular data URL
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
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
