import { describe, it, expect } from "vitest";
import {
  textToDataUrl,
  jsonToDataUrl,
  bufferToDataUrl,
  typedArrayToDataUrl,
  dataUrlToText,
  dataUrlToJson,
  dataUrlToBuffer,
  dataUrlToTypedArray,
  isDataUrl,
  urlToDataUrl,
  dataUrlToUrl,
  isUrlDataUrl,
  dereferenceDataRefs,
} from "../index";

describe("v2 DataRef - Basic Type Conversions", () => {
  describe("Text conversions", () => {
    it("should convert text to data URL and back", async () => {
      const originalText = "Hello, World!";
      const dataUrl = textToDataUrl(originalText);

      expect(isDataUrl(dataUrl)).toBe(true);
      expect(dataUrl).toMatch(/^data:text\/plain/);

      const decodedText = await dataUrlToText(dataUrl);
      expect(decodedText).toBe(originalText);
    });

    it("should handle empty string", async () => {
      const originalText = "";
      const dataUrl = textToDataUrl(originalText);
      const decodedText = await dataUrlToText(dataUrl);
      expect(decodedText).toBe(originalText);
    });

    it("should handle unicode text", async () => {
      const originalText = "Hello 世界 🌍";
      const dataUrl = textToDataUrl(originalText);
      const decodedText = await dataUrlToText(dataUrl);
      expect(decodedText).toBe(originalText);
    });

    it("should handle special characters", async () => {
      const originalText = "Line1\nLine2\tTabbed\r\nWindows";
      const dataUrl = textToDataUrl(originalText);
      const decodedText = await dataUrlToText(dataUrl);
      expect(decodedText).toBe(originalText);
    });
  });

  describe("JSON conversions", () => {
    it("should convert simple object to data URL and back", async () => {
      const originalData = { name: "John", age: 30 };
      const dataUrl = jsonToDataUrl(originalData);

      expect(isDataUrl(dataUrl)).toBe(true);
      expect(dataUrl).toMatch(/^data:application\/json/);

      const decodedData = await dataUrlToJson(dataUrl);
      expect(decodedData).toEqual(originalData);
    });

    it("should handle nested objects", async () => {
      const originalData = {
        user: {
          name: "Jane",
          address: {
            street: "123 Main St",
            city: "Boston",
          },
        },
      };
      const dataUrl = jsonToDataUrl(originalData);
      const decodedData = await dataUrlToJson(dataUrl);
      expect(decodedData).toEqual(originalData);
    });

    it("should handle arrays", async () => {
      const originalData = [1, 2, 3, "four", { five: 5 }];
      const dataUrl = jsonToDataUrl(originalData);
      const decodedData = await dataUrlToJson(dataUrl);
      expect(decodedData).toEqual(originalData);
    });

    it("should handle null and boolean values", async () => {
      const originalData = { flag: true, value: null, disabled: false };
      const dataUrl = jsonToDataUrl(originalData);
      const decodedData = await dataUrlToJson(dataUrl);
      expect(decodedData).toEqual(originalData);
    });

    it("should handle numbers including floats and negative", async () => {
      const originalData = { int: 42, float: 3.14159, negative: -100 };
      const dataUrl = jsonToDataUrl(originalData);
      const decodedData = await dataUrlToJson(dataUrl);
      expect(decodedData).toEqual(originalData);
    });

    it("should handle empty object and array", async () => {
      const emptyObj = {};
      const emptyArr: any[] = [];

      const objDataUrl = jsonToDataUrl(emptyObj);
      const arrDataUrl = jsonToDataUrl(emptyArr);

      expect(await dataUrlToJson(objDataUrl)).toEqual(emptyObj);
      expect(await dataUrlToJson(arrDataUrl)).toEqual(emptyArr);
    });
  });

  describe("ArrayBuffer conversions", () => {
    it("should convert ArrayBuffer to data URL and back", async () => {
      const originalBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const dataUrl = bufferToDataUrl(originalBuffer);

      expect(isDataUrl(dataUrl)).toBe(true);
      expect(dataUrl).toMatch(/^data:application\/octet-stream/);

      const decodedBuffer = await dataUrlToBuffer(dataUrl);
      const decodedArray = new Uint8Array(decodedBuffer);
      const originalArray = new Uint8Array(originalBuffer);

      expect(decodedArray).toEqual(originalArray);
    });

    it("should handle Uint8Array directly", async () => {
      const originalArray = new Uint8Array([255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const dataUrl = bufferToDataUrl(originalArray);
      const decodedBuffer = await dataUrlToBuffer(dataUrl);
      const decodedArray = new Uint8Array(decodedBuffer);

      expect(decodedArray).toEqual(originalArray);
    });

    it("should handle empty buffer", async () => {
      const originalBuffer = new Uint8Array([]).buffer;
      const dataUrl = bufferToDataUrl(originalBuffer);
      const decodedBuffer = await dataUrlToBuffer(dataUrl);
      const decodedArray = new Uint8Array(decodedBuffer);

      expect(decodedArray.length).toBe(0);
    });
  });

  describe("TypedArray conversions", () => {
    it("should convert Uint8Array to data URL and back", async () => {
      const originalArray = new Uint8Array([10, 20, 30, 40, 50]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Uint8Array");

      expect(isDataUrl(dataUrl)).toBe(true);

      const decodedArray = await dataUrlToTypedArray<Uint8Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert Int32Array to data URL and back", async () => {
      const originalArray = new Int32Array([-1000, 0, 1000, 2000]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Int32Array");

      const decodedArray = await dataUrlToTypedArray<Int32Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert Float32Array to data URL and back", async () => {
      const originalArray = new Float32Array([1.1, 2.2, 3.3, -4.4]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Float32Array");

      const decodedArray = await dataUrlToTypedArray<Float32Array>(dataUrl);
      expect(decodedArray.length).toBe(originalArray.length);
      for (let i = 0; i < originalArray.length; i++) {
        expect(decodedArray[i]).toBeCloseTo(originalArray[i]);
      }
    });

    it("should convert Float64Array to data URL and back", async () => {
      const originalArray = new Float64Array([
        Math.PI,
        Math.E,
        -123.456789,
        0.000001,
      ]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Float64Array");

      const decodedArray = await dataUrlToTypedArray<Float64Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert Int16Array to data URL and back", async () => {
      const originalArray = new Int16Array([-32768, -100, 0, 100, 32767]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Int16Array");

      const decodedArray = await dataUrlToTypedArray<Int16Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert Uint32Array to data URL and back", async () => {
      const originalArray = new Uint32Array([0, 1000, 1000000, 4294967295]);
      const dataUrl = typedArrayToDataUrl(originalArray, "Uint32Array");

      const decodedArray = await dataUrlToTypedArray<Uint32Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert BigInt64Array to data URL and back", async () => {
      const originalArray = new BigInt64Array([
        BigInt(-9007199254740991),
        BigInt(0),
        BigInt(9007199254740991),
      ]);
      const dataUrl = typedArrayToDataUrl(originalArray, "BigInt64Array");

      const decodedArray = await dataUrlToTypedArray<BigInt64Array>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });

    it("should convert Uint8ClampedArray to data URL and back", async () => {
      const originalArray = new Uint8ClampedArray([0, 127, 255]);
      const dataUrl = typedArrayToDataUrl(
        originalArray,
        "Uint8ClampedArray"
      );

      const decodedArray =
        await dataUrlToTypedArray<Uint8ClampedArray>(dataUrl);
      expect(decodedArray).toEqual(originalArray);
    });
  });

  describe("URL handling", () => {
    it("should convert URL to data URL without fetching", async () => {
      const url = "https://example.com/data.json";
      const dataUrl = await urlToDataUrl(url);

      expect(isDataUrl(dataUrl)).toBe(true);
      expect(isUrlDataUrl(dataUrl)).toBe(true);

      const decodedUrl = dataUrlToUrl(dataUrl);
      expect(decodedUrl).toBe(url);
    });

    it("should handle URL with query parameters", async () => {
      const url = "https://example.com/api?param1=value1&param2=value2";
      const dataUrl = await urlToDataUrl(url);
      const decodedUrl = dataUrlToUrl(dataUrl);
      expect(decodedUrl).toBe(url);
    });

    it("should handle URL with hash", async () => {
      const url = "https://example.com/page#section";
      const dataUrl = await urlToDataUrl(url);
      const decodedUrl = dataUrlToUrl(dataUrl);
      expect(decodedUrl).toBe(url);
    });

    it("should return null when converting non-URL data URL", async () => {
      const textDataUrl = textToDataUrl("Hello");
      const url = dataUrlToUrl(textDataUrl);
      expect(url).toBeNull();
    });
  });

  describe("isDataUrl validation", () => {
    it("should return true for valid data URLs", () => {
      expect(isDataUrl("data:text/plain,hello")).toBe(true);
      expect(isDataUrl("data:application/json,{}")).toBe(true);
      expect(isDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    });

    it("should return false for non-data URLs", () => {
      expect(isDataUrl("http://example.com")).toBe(false);
      expect(isDataUrl("hello world")).toBe(false);
      expect(isDataUrl("")).toBe(false);
      expect(isDataUrl(null)).toBe(false);
      expect(isDataUrl(undefined)).toBe(false);
      expect(isDataUrl(123)).toBe(false);
      expect(isDataUrl({})).toBe(false);
    });
  });

  describe("dereferenceDataRefs", () => {
    it("should dereference a simple object with text dataref", async () => {
      const textDataUrl = textToDataUrl("Hello, World!");
      const input = {
        message: textDataUrl,
        count: 42,
      };

      const result = await dereferenceDataRefs(input);
      expect(result.message).toBe("Hello, World!");
      expect(result.count).toBe(42);
    });

    it("should dereference nested objects with datarefs", async () => {
      const textDataUrl = textToDataUrl("nested text");
      const jsonDataUrl = jsonToDataUrl({ inner: "data" });

      const input = {
        outer: {
          text: textDataUrl,
          data: jsonDataUrl,
          normal: "regular string",
        },
      };

      const result = await dereferenceDataRefs(input);
      expect(result.outer.text).toBe("nested text");
      expect(result.outer.data).toEqual({ inner: "data" });
      expect(result.outer.normal).toBe("regular string");
    });

    it("should dereference arrays with datarefs", async () => {
      const dataUrl1 = textToDataUrl("item1");
      const dataUrl2 = jsonToDataUrl({ key: "value" });
      const dataUrl3 = textToDataUrl("item3");

      const input = {
        items: [dataUrl1, "regular", dataUrl2, 123, dataUrl3],
      };

      const result = await dereferenceDataRefs(input);
      expect(result.items[0]).toBe("item1");
      expect(result.items[1]).toBe("regular");
      expect(result.items[2]).toEqual({ key: "value" });
      expect(result.items[3]).toBe(123);
      expect(result.items[4]).toBe("item3");
    });

    it("should handle deeply nested structures", async () => {
      const dataUrl = jsonToDataUrl({ deep: "value" });

      const input = {
        level1: {
          level2: {
            level3: {
              data: dataUrl,
            },
          },
        },
      };

      const result = await dereferenceDataRefs(input);
      expect(result.level1.level2.level3.data).toEqual({ deep: "value" });
    });

    it("should handle multiple datarefs in the same object", async () => {
      const text1 = textToDataUrl("first");
      const text2 = textToDataUrl("second");
      const json1 = jsonToDataUrl({ a: 1 });
      const json2 = jsonToDataUrl({ b: 2 });

      const input = {
        text1,
        text2,
        json1,
        json2,
        regular: "unchanged",
      };

      const result = await dereferenceDataRefs(input);
      expect(result.text1).toBe("first");
      expect(result.text2).toBe("second");
      expect(result.json1).toEqual({ a: 1 });
      expect(result.json2).toEqual({ b: 2 });
      expect(result.regular).toBe("unchanged");
    });

    it("should handle objects with no datarefs", async () => {
      const input = {
        text: "regular string",
        number: 42,
        bool: true,
        nested: { key: "value" },
      };

      const result = await dereferenceDataRefs(input);
      expect(result).toEqual(input);
    });

    it("should handle null and undefined values", async () => {
      const dataUrl = textToDataUrl("test");
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        dataRef: dataUrl,
      };

      const result = await dereferenceDataRefs(input);
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.dataRef).toBe("test");
    });

    it("should handle empty objects and arrays", async () => {
      const input = {
        emptyObj: {},
        emptyArr: [],
        dataRef: textToDataUrl("value"),
      };

      const result = await dereferenceDataRefs(input);
      expect(result.emptyObj).toEqual({});
      expect(result.emptyArr).toEqual([]);
      expect(result.dataRef).toBe("value");
    });

    it("should dereference TypedArray datarefs", async () => {
      const typedArrayDataUrl = typedArrayToDataUrl(
        new Uint8Array([1, 2, 3]),
        "Uint8Array"
      );

      const input = {
        buffer: typedArrayDataUrl,
      };

      const result = await dereferenceDataRefs(input);
      expect(result.buffer).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("should dereference ArrayBuffer datarefs", async () => {
      const bufferDataUrl = bufferToDataUrl(new Uint8Array([10, 20, 30]));

      const input = {
        data: bufferDataUrl,
      };

      const result = await dereferenceDataRefs(input);
      const resultArray = new Uint8Array(result.data);
      expect(resultArray).toEqual(new Uint8Array([10, 20, 30]));
    });

    it("should handle mixed types in complex structure", async () => {
      const textUrl = textToDataUrl("text content");
      const jsonUrl = jsonToDataUrl({ nested: { value: 123 } });
      const arrayUrl = typedArrayToDataUrl(
        new Float32Array([1.1, 2.2]),
        "Float32Array"
      );

      const input = {
        metadata: {
          title: textUrl,
          config: jsonUrl,
        },
        data: {
          values: arrayUrl,
          count: 2,
        },
        items: ["regular", textUrl, { key: jsonUrl }],
      };

      const result = await dereferenceDataRefs(input);
      expect(result.metadata.title).toBe("text content");
      expect(result.metadata.config).toEqual({ nested: { value: 123 } });
      expect(result.data.values).toEqual(new Float32Array([1.1, 2.2]));
      expect(result.data.count).toBe(2);
      expect(result.items[0]).toBe("regular");
      expect(result.items[1]).toBe("text content");
      expect(result.items[2].key).toEqual({ nested: { value: 123 } });
    });
  });
});
