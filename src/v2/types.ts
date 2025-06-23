// Basic types for the v2 API
export type DataUrl = string; // Must start with "data:"

// MIME types we support
export const MIME_TYPES = {
  TEXT: "text/plain",
  JSON: "application/json",
  OCTET_STREAM: "application/octet-stream",
  // For typed arrays, we'll use application/octet-stream with a type parameter
  TYPED_ARRAY: "application/octet-stream;type=",
  // Custom MIME type for URLs that should be treated as data references
  URI: "text/x-uri",
} as const;

// Supported typed array types
export type TypedArrayType =
  | "Int8Array"
  | "Uint8Array"
  | "Int16Array"
  | "Uint16Array"
  | "Int32Array"
  | "Uint32Array"
  | "Float32Array"
  | "Float64Array"
  | "BigInt64Array"
  | "BigUint64Array";

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

// Helper type for typed array constructors
export type TypedArrayConstructor = {
  [K in TypedArrayType]: new (buffer: ArrayBuffer) => InstanceType<
    (typeof globalThis)[K]
  >;
}[TypedArrayType];
