// represents a way of getting a blob of data (inputs/outputs)
export enum DataRefType {
  /* default, value is a base64 encoded bytes. Can be encoded TypedArray or Blob */
  base64 = "base64",
  url = "url", // request the data at this URL
  utf8 = "utf8",
  json = "json",
  // serialized = "serialized",
  // the internal system can get this data blob given the key address (stored in the value)
  // this can be the sha256 hash of the data, or some other identifier
  key = "key",
}

const DataRefTypeKeys: string[] = Object.keys(DataRefType).filter((key) =>
  isNaN(Number(key))
);
export const DataRefTypesSet = new Set(DataRefTypeKeys);
export const DataRefTypeDefault = DataRefType.utf8;

export type DataRef<T = string> = {
  /* We want to be unambigous here */
  ref: DataRefType;
  value: T;
  // mime type / file type
  contentType?: string;
  size?: number;
  sha256?: string;
  created?: string;
};

export type DataRefSerialized = Omit<DataRef, "size"> & {
  // constructor name, e.g. "Uint8Array" or "Blob"
  c: string;
  // required here, but optional in the parent type
  size: number;
};

export type DataRefSerializedTypedArray = DataRefSerialized & {
  // Typed arrays are from ArrayBufferView
  byteLength: number;
  byteOffset: number;
};

export type DataRefSerializedBlob = Omit<DataRefSerialized, "contentType"> & {
  contentType: string;
};

export type DataRefSerializedFile = DataRefSerialized & {
  name: string;
  lastModified?: number;
};
