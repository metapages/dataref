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
  | "BigInt64Array"
  | "BigUint64Array"
  | "Float32Array"
  | "Float64Array"
  | "Int16Array"
  | "Int32Array"
  | "Int8Array"
  | "Uint16Array"
  | "Uint32Array"
  | "Uint8Array"
  | "Uint8ClampedArray";

export type DataRefTypedArray =
  | BigInt64Array
  | BigUint64Array
  | Float32Array
  | Float64Array
  | Int16Array
  | Int32Array
  | Int8Array
  | Uint16Array
  | Uint32Array
  | Uint8Array
  | Uint8ClampedArray;

// Helper type for typed array constructors
export type TypedArrayConstructor = {
  [K in TypedArrayType]: new (buffer: ArrayBuffer) => InstanceType<
    (typeof globalThis)[K]
  >;
}[TypedArrayType];
