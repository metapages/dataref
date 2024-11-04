import { decodeBase64 } from './base64';
import {
  type DataRef,
  DataRefType,
  DataRefTypesSet,
} from './types';

type FetchBlobFromKey = (key: String) => Promise<Uint8Array>;

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
      const arrayBufferFromUrl = await urlToUint8Array(ref.value as string);
      return arrayBufferFromUrl;
    }
    case DataRefType.key: {
      // hard code this for now
      const fetcher = fetchBlobFromKey ?? globalFetchBlobFromKey;
      if (!fetcher) {
        throw new Error("No fetchBlobFromKey function provided, and setGlobalFetchBlobFromKey not called");
      }
      const arrayBufferFromKey = await fetcher(ref.value);
      return new Uint8Array(arrayBufferFromKey);
    }
    default: // undefined assume DataRefType.Base64
      throw `Not yet implemented: DataRef.type "${ref.type}" unknown`;
  }
};

/**
 * Take a dataref and return a download link for the data
 */
export const dataRefToDownloadLink = async (ref: DataRef, fetchBlobFromKey?: FetchBlobFromKey): Promise<string> => {
  const buffer = await dataRefToBuffer(ref, fetchBlobFromKey);
  return URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
};

const urlToUint8Array = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};
