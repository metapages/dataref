// Main exports - v2 API (recommended)
// v1 is kept internal for backwards compatibility only

export {
  // Core encoding functions
  textToDataUrl,
  jsonToDataUrl,
  bufferToDataUrl,
  typedArrayToDataUrl,
  urlToDataUrl,
  fileToDataUrl,

  // Core decoding functions
  dataUrlToText,
  dataUrlToJson,
  dataUrlToBuffer,
  dataUrlToTypedArray,
  dataUrlToUrl,
  dataUrlToFile,

  // Utility functions
  dereferenceDataRefs,
  isDataUrl,
  isUrlDataUrl,
  getMimeType,
  getParameters,
  fetchDataUrlContent,
} from "./v2/dataref";

export {
  // Types
  type DataUrl,
  type TypedArrayType,
  type DataRefTypedArray,
  MIME_TYPES,
} from "./v2/types";

export {
  // Validation function that checks both v1 and v2
  isDataRef,
} from "./v2/index";
