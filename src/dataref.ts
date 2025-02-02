import { decodeBase64 } from './base64';
import {
  type DataRef,
  DataRefType,
  DataRefTypesSet,
} from './types';

type FetchBlobFromKey = (key: String) => Promise<{buffer: ArrayBuffer, type:string}>;

let globalFetchBlobFromKey: FetchBlobFromKey | undefined;

export const setGlobalFetchBlobFromKey = (fetchBlobFromKey: FetchBlobFromKey) => {
  globalFetchBlobFromKey = fetchBlobFromKey;
};

export const isDataRef = (value: any): boolean => {
  return !!(
    value &&
    typeof value === "object" &&
    (value as DataRef)?.type &&
    DataRefTypesSet.has((value as DataRef).type!) &&
    (value as DataRef)?.value !== undefined
  );
};

export const dataRefToBuffer = async (ref: DataRef, fetchBlobFromKey?: FetchBlobFromKey): Promise<Uint8Array> => {
  switch (ref.type) {
    case DataRefType.base64:
      return decodeBase64(ref.value as string);
    case DataRefType.utf8:
      return new TextEncoder().encode(ref.value as string);
    case DataRefType.json:
      return new TextEncoder().encode(JSON.stringify(ref.value));
    case DataRefType.url: {
      const {buffer:arrayBufferFromUrl} = await urlToArrayBuffer(ref.value as string);
      return new Uint8Array(arrayBufferFromUrl);
    }
    case DataRefType.key: {
      // hard code this for now
      const fetcher = fetchBlobFromKey ?? globalFetchBlobFromKey;
      if (!fetcher) {
        throw new Error("No fetchBlobFromKey function provided, and setGlobalFetchBlobFromKey not called");
      }
      const {buffer:arrayBufferFromKey} = await fetcher(ref.value);
      return new Uint8Array(arrayBufferFromKey);
    }
    default: // undefined assume DataRefType.Base64
      throw `Not yet implemented: DataRef.type "${ref.type}" unknown`;
  }
};

export const dataRefToFile = async (ref: DataRef, opts?: {
  fetchBlobFromKey?: FetchBlobFromKey;
  name?: string;
}): Promise<File> => {
  let { fetchBlobFromKey, name } = opts ?? {};
  switch (ref.type) {
    case DataRefType.base64:
      const bufferBase64 = decodeBase64(ref.value as string);
      name = name ?? await sha256Buffer(bufferBase64);
      return new File([bufferBase64], name, { type: "application/octet-stream" });
    case DataRefType.utf8:
      name = name ?? await sha256Text(ref.value);
      return new File([ref.value], name, { type: "text/plain" });
    case DataRefType.json:
      const bufferJson = new TextEncoder().encode(JSON.stringify(ref.value));
      name = name ?? await sha256Buffer(bufferJson);
      return new File([bufferJson], name, { type: "application/json" });
    case DataRefType.url:
      const {buffer:bufferUrl, type} = await urlToArrayBuffer(ref.value as string);
      name = name ?? await sha256Buffer(bufferUrl);
      return new File([bufferUrl], name, { type });
    case DataRefType.key: {
      const fetcher = fetchBlobFromKey ?? globalFetchBlobFromKey;
      if (!fetcher) {
        throw new Error("No fetchBlobFromKey function provided, and setGlobalFetchBlobFromKey not called");
      }
      const {buffer:bufferFromKey, type} = await fetcher(ref.value);
      name = name ?? await sha256Buffer(bufferFromKey);
      return new File([bufferFromKey], name, { type: type || "application/octet-stream" });
    }
    default:
      throw `Not yet implemented: DataRef.type "${ref.type}" unknown`;
  }
};

export const dataRefToObject = async (ref: DataRef, opts?: {
  fetchBlobFromKey?: FetchBlobFromKey;
  name?: string;
}): Promise<string | object | File> => {
  const file = await dataRefToFile(ref, opts);
  return await fileToObject(file);
};

export const dataRefToSerializedObject = async (ref: DataRef, opts?: {
  fetchBlobFromKey?: FetchBlobFromKey;
  name?: string;
}): Promise<string | object | DataRef> => {
  let { fetchBlobFromKey, name } = opts ?? {};
  switch (ref.type) {
    case DataRefType.base64:
      return ref;
    case DataRefType.utf8:
      return ref;
    case DataRefType.json:
      return ref;
    case DataRefType.url:
      const {buffer:bufferUrl, type} = await urlToArrayBuffer(ref.value as string);
      name = name ?? await sha256Buffer(bufferUrl);
      return new File([bufferUrl], name, { type });
    case DataRefType.key: {
      const fetcher = fetchBlobFromKey ?? globalFetchBlobFromKey;
      if (!fetcher) {
        throw new Error("No fetchBlobFromKey function provided, and setGlobalFetchBlobFromKey not called");
      }
      const {buffer:bufferFromKey, type} = await fetcher(ref.value);
      name = name ?? await sha256Buffer(bufferFromKey);
      return new File([bufferFromKey], name, { type: type || "application/octet-stream" });
    }
    default:
      throw `Not yet implemented: DataRef.type "${ref.type}" unknown`;
  }
};

export const fileToObject = async (file: File): Promise<string | object | File> => {
  const mimeType = file.type.split(';')[0].trim();
  
  // Handle text-based files
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    const text = await file.text();
    
    // Try to parse JSON if it's a JSON file
    if (mimeType === 'application/json') {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn('Failed to parse JSON file, returning as text', e);
        return text;
      }
    }
    
    return text;
  } 
  // Return the original file for binary types
  return file;
};

export const sha256Buffer = async (buffer: BufferSource): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

export const sha256Text = async (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return sha256Buffer(data);
};

/**
 * Take a dataref and return a download link for the data
 */
export const dataRefToDownloadLink = async (ref: DataRef, fetchBlobFromKey?: FetchBlobFromKey): Promise<string> => {
  const buffer = await dataRefToBuffer(ref, fetchBlobFromKey);
  return URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
};

const urlToArrayBuffer = async (url: string): Promise<{buffer: ArrayBuffer, type:string}> => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  const arrayBuffer = await response.arrayBuffer();
  
  return { buffer: arrayBuffer, type: contentType };
};
