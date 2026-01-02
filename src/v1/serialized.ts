import {
  decode,
  encode,
} from 'base64-arraybuffer';

import {
  type DataRefSerialized,
  type DataRefSerializedBlob,
  type DataRefSerializedFile,
  type DataRefSerializedTypedArray,
  DataRefType,
} from './types';

// export type DataRefSerialized = {
//   // This means it's a serialized DataRef
//   _s: true;
//   // constructor
//   _c: string;
//   // value is base64 encoded
//   value: string;
//   size: number;
// };

// export type DataRefSerializedTypedArray = DataRefSerialized & {
//   // Typed arrays are from ArrayBufferView
//   byteLength: number;
//   byteOffset: number;
// };

// export type DataRefSerializedBlob = DataRefSerialized & {
//   fileType?: string;
// };

// export type DataRefSerializedFile = DataRefSerializedBlob & {
//   name: string;
//   lastModified?: number;
// };

export const valueToFile = async (
  value: any,
  fileName: string,
  options?: FilePropertyBag
): Promise<File> => {
  value = possiblyDeserializeDataRefSerializedToValue(value);
  options = options || {};
  if (!options.type) {
    options.type = "application/octet-stream";
  }

  if (value instanceof ArrayBuffer) {
    return new File([value], fileName, options);
  }
  if (value instanceof File || value instanceof Blob) {
    const buffer = await value.arrayBuffer();
    if (value instanceof File) {
      options.type = (value as File).type;
    }
    return new File([buffer], fileName, options);
  }
  if (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  ) {
    const typedValue = value as ArrayBufferView;
    return new File([typedValue.buffer], fileName, options);
  }
  if (typeof value === "string") {
    var blob = new Blob([value], { type: "text/plain" });
    options.type = "text/plain";
    return new File([blob], fileName, options);
  }
  if (typeof value === "object") {
    const blob = new Blob([JSON.stringify(value)], {
      type: "application/json",
    });
    options.type = "application/json";
    return new File([blob], fileName, options);
  }

  // assume it's a string
  var blob = new Blob([value as string], { type: "text/plain" });
  options.type = "text/plain";
  return new File([blob], fileName, options);
};

export type DataRefTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export const possiblySerializeValueToDataref = async <T>(
  value: T
): Promise<T | DataRefSerialized> => {
  if (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  ) {
    const typedValue = value as ArrayBufferView;
    const replacement: DataRefSerializedTypedArray = {
      ref: DataRefType.base64,
      c: value.constructor.name,
      value: encode(typedValue.buffer),
      byteLength: typedValue.byteLength,
      byteOffset: typedValue.byteOffset,
      size: typedValue.byteLength,
    };
    return Promise.resolve(replacement);
  } else if (value instanceof File) {
    const typedValue = value as File;
    const arrayBuffer = await typedValue.arrayBuffer();
    const replacement: DataRefSerializedFile = {
      ref: DataRefType.base64,
      c: File.name,
      value: encode(arrayBuffer),
      name: typedValue.name,
      contentType: typedValue.type,
      lastModified: typedValue.lastModified,
      size: arrayBuffer.byteLength,
    };
    return replacement;
  } else if (value instanceof Blob) {
    const typedValue = value as Blob;
    const arrayBuffer = await typedValue.arrayBuffer();
    const replacement: DataRefSerializedBlob = {
      ref: DataRefType.base64,
      c: Blob.name,
      value: encode(arrayBuffer),
      contentType: typedValue.type,
      size: arrayBuffer.byteLength,
    };
    return replacement;
  } else if (value instanceof ArrayBuffer) {
    const typedValue = value as ArrayBuffer;
    const replacement: DataRefSerialized = {
      ref: DataRefType.base64,
      c: ArrayBuffer.name,
      value: encode(typedValue),
      size: typedValue.byteLength,
    };
    return Promise.resolve(replacement);
  }
  return Promise.resolve(value);
};

export const possiblyDeserializeDataRefSerializedToValue = (
  value: any
): any => {
  if (!isDatarefSerialized(value)) {
    return value;
  }
  return deserializeDataRefSerializedToValue(value as DataRefSerialized);
};

export const deserializeDataRefSerializedToValue = (
  serializedRef: DataRefSerialized
): Blob | File | ArrayBuffer | ArrayBufferView | DataRefTypedArray => {
  const _c: string = serializedRef.c;
  if (_c === Blob.name) {
    const serializedRefBlob = serializedRef as DataRefSerializedBlob;
    const blob = new Blob([decode(serializedRef.value)], {
      type: serializedRefBlob.contentType,
    });
    return blob;
  } else if (_c === File.name) {
    const serializedRefFile = serializedRef as DataRefSerializedFile;
    const file = new File(
      [decode(serializedRef.value)],
      serializedRefFile.name,
      {
        type: serializedRefFile.contentType,
        lastModified: serializedRefFile.lastModified,
      }
    );
    return file;
  } else if (_c === ArrayBuffer.name) {
    const arrayBuffer: ArrayBuffer = decode(serializedRef.value);
    return arrayBuffer;
  }
  // Assume typed array
  const serializedRefTypedArray = serializedRef as DataRefSerializedTypedArray;

  const arrayBuffer: ArrayBuffer = decode(serializedRefTypedArray.value);
  const constructorName: string = serializedRefTypedArray.c;

  // @ts-ignore
  const typedArray: ArrayBufferView = new globalThis[constructorName](
    arrayBuffer
    // serializedRefTypedArray.byteOffset,
    // serializedRefTypedArray.byteLength
  );
  return typedArray;
};

export const isDatarefSerialized = (value: any): boolean => {
  return (
    value &&
    typeof value === "object" &&
    (value as DataRefSerialized)?.ref == DataRefType.base64 &&
    (value as DataRefSerialized)?.value &&
    (value as DataRefSerialized)?.c
  );
};

export const possiblyDeserializeDatarefToFile = (
  value: any
): File | undefined => {
  if (!isDatarefSerialized(value)) {
    return value;
  }
  
  const serializedRef = value as DataRefSerialized;
  const _c: string = serializedRef.c;
  if (_c === Blob.name) {
    const serializedRefBlob = value as DataRefSerializedBlob;
    const blob = new Blob([decode(serializedRef.value)], {
      type: serializedRefBlob.contentType,
    });
    return new File([blob], "file", {
      type: blob.type,
    });
  } else if (_c === File.name) {
    const serializedRefFile = value as DataRefSerializedFile;
    const file = new File(
      [decode(serializedRef.value)],
      serializedRefFile.name,
      {
        type: serializedRefFile.contentType,
        lastModified: serializedRefFile.lastModified,
      }
    );
    return file;
  } else if (_c === ArrayBuffer.name) {
    const arrayBuffer: ArrayBuffer = decode(serializedRef.value);
    return new File([arrayBuffer], "file", {
      type: "application/octet-stream",
    });
  }
  // Assume typed array
  const serializedRefTypedArray = value as DataRefSerializedTypedArray;
  const arrayBuffer: ArrayBuffer = decode(serializedRefTypedArray.value);
  const constructorName: string = serializedRefTypedArray.c;

  try {
    // @ts-ignore
    const typedArray: ArrayBufferView = new globalThis[constructorName](
      arrayBuffer
    );
    return new File([typedArray], "file", {
      type: "application/octet-stream",
    });
  } catch (e) {}
  return undefined;
};
