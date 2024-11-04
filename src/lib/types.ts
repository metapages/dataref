// represents a way of getting a blob of data (inputs/outputs)
export enum DataRefType {
  base64 = "base64", //default, value is a base64 encoded bytes
  url = "url", // request the data at this URL
  utf8 = "utf8",
  json = "json",
  // the internal system can get this data blob given the key address (stored in the value)
  // this can be the sha256 hash of the data, or some other identifier
  key = "key",
}

const DataRefTypeKeys :string[] = Object.keys(DataRefType).filter(key => isNaN(Number(key)));
export const DataRefTypesSet = new Set(DataRefTypeKeys);
export const DataRefTypeDefault = DataRefType.utf8;

export type DataRef<T = string> = {
  value: T;
  type?: DataRefType;
  mime?: string;
  hash?: string;
  created?: number|string;
};

