import { decode } from 'base64-arraybuffer';

import {
  getContentType,
  sha256Buffer,
} from './dataref';
import {
  type DataRef,
  DataRefType,
} from './types';

let maxDataLength = 200;

export const setMaxDataLength = (length: number) => {
  maxDataLength = length;
};

export const getMaxDataLength = () => {
  return maxDataLength;
};

const _encoder = new TextEncoder();
export const utf8ToBuffer = (str: string): Uint8Array => {
  return _encoder.encode(str);
};

const defaultUpload = async (ref: DataRef, url:string, data: Uint8Array|ArrayBuffer) :Promise<string> => {
  const responseUpload = await fetch(url, {
    method: "PUT",
    body: new Uint8Array(data),
    // @ts-ignore: TS2353
    method: "PUT",
    // @ts-ignore: TS2353
    redirect: "follow",
    headers: { "Content-Type": getContentType(ref) },
  });
  if (!responseUpload.ok) {
    throw new Error(`Failed to get upload URL: ${url}`);
  }
  return url;
};

export const copyLargeBlobToCloud = async (
  ref: DataRef,
  opts: {
    // If the returned uploadUrl is undefined, the blob is already uploaded
    getUploadUrl: (ref: DataRef) => Promise<string>,
    // returns the URL for the corresponding download
    upload?: (ref: DataRef, url: string, data: Uint8Array|ArrayBuffer) => Promise<string>,
    maxDataLength?: number,
  },
): Promise<DataRef> => {
  let upload = opts.upload ?? defaultUpload;
  const url = await opts.getUploadUrl(ref);

  let maxDataLengthActual = opts.maxDataLength ?? maxDataLength;

  const type = ref.type || "url";
  let uint8ArrayIfBig: Uint8Array|ArrayBuffer | undefined;
  // let contentType: string | undefined;
  switch (type) {
    case DataRefType.key:
      // this is already cloud storage. no need to re-upload
      return ref;
    case DataRefType.url:
      // this is already somewhere else.
      return ref;
    case DataRefType.json:
      if (ref.value) {
        const jsonString = JSON.stringify(ref.value);
        if (jsonString.length > maxDataLengthActual) {
          uint8ArrayIfBig = utf8ToBuffer(jsonString);
        }
        // contentType = "application/json";
      }
      break;
    case DataRefType.base64:
      if ((ref.value as string).length > maxDataLengthActual) {
        uint8ArrayIfBig = decode(ref.value);
      }
      // contentType = ref.contentType || "application/octet-stream";
      break;
    case DataRefType.utf8:
      if ((ref.value as string)?.length > maxDataLengthActual) {
        uint8ArrayIfBig = utf8ToBuffer(ref.value);
      }
      break;
    default:
  }

  if (uint8ArrayIfBig) {
    // upload and replace the dataref
    const urlForDownload = await upload(ref, url, uint8ArrayIfBig);
    const sha256 = await sha256Buffer(uint8ArrayIfBig);

    const newRef: DataRef = {
      value: urlForDownload,
      type: DataRefType.url,
      contentType: ref.contentType,
      sha256: sha256,
    };
    return newRef;
  } else {
      return ref;
  }
};
