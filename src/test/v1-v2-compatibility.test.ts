import { describe, it, expect } from "vitest";
import { DataRef, DataRefType } from "../v1/types";
import { isDataRef as isDataRefV1 } from "../v1/dataref";
import {
  isDataUrl,
  isDataRef,
  textToDataUrl,
  jsonToDataUrl,
  bufferToDataUrl,
  dataUrlToText,
  dataUrlToJson,
  dataUrlToBuffer,
  dereferenceDataRefs,
} from "../index";

describe("v1 and v2 DataRef Compatibility", () => {
  describe("isDataRef should detect both v1 and v2 formats", () => {
    it("should detect v2 data URL strings", () => {
      const v2TextDataRef = textToDataUrl("hello");
      const v2JsonDataRef = jsonToDataUrl({ key: "value" });

      expect(isDataRef(v2TextDataRef)).toBe(true);
      expect(isDataUrl(v2TextDataRef)).toBe(true);

      expect(isDataRef(v2JsonDataRef)).toBe(true);
      expect(isDataUrl(v2JsonDataRef)).toBe(true);
    });

    it("should detect v1 DataRef objects", () => {
      const v1TextDataRef: DataRef = {
        ref: DataRefType.utf8,
        value: "hello",
      };

      const v1JsonDataRef: DataRef = {
        ref: DataRefType.json,
        value: { key: "value" },
      };

      expect(isDataRef(v1TextDataRef)).toBe(true);
      expect(isDataRefV1(v1TextDataRef)).toBe(true);

      expect(isDataRef(v1JsonDataRef)).toBe(true);
      expect(isDataRefV1(v1JsonDataRef)).toBe(true);
    });

    it("should not detect regular objects/strings as datarefs", () => {
      expect(isDataRef({ key: "value" })).toBe(false);
      expect(isDataRef("regular string")).toBe(false);
      expect(isDataRef(123)).toBe(false);
      expect(isDataRef(null)).toBe(false);
    });
  });

  describe("v1 to v2 conversion", () => {
    it("should convert v1 utf8 DataRef to v2 data URL", () => {
      const v1Ref: DataRef = {
        ref: DataRefType.utf8,
        value: "Hello, World!",
      };

      // Convert to v2
      const v2DataUrl = textToDataUrl(v1Ref.value as string);

      expect(isDataUrl(v2DataUrl)).toBe(true);
      expect(v2DataUrl).toMatch(/^data:text\/plain/);
    });

    it("should convert v1 json DataRef to v2 data URL", () => {
      const v1Ref: DataRef = {
        ref: DataRefType.json,
        value: { name: "John", age: 30 },
      };

      // Convert to v2
      const v2DataUrl = jsonToDataUrl(v1Ref.value);

      expect(isDataUrl(v2DataUrl)).toBe(true);
      expect(v2DataUrl).toMatch(/^data:application\/json/);
    });

    it("should convert v1 base64 DataRef to v2 data URL", async () => {
      // Create a base64 encoded string
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const base64String = btoa(String.fromCharCode(...originalData));

      const v1Ref: DataRef = {
        ref: DataRefType.base64,
        value: base64String,
      };

      // In v2, we use bufferToDataUrl for binary data
      // First decode the base64 to get the buffer
      const binaryString = atob(v1Ref.value as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const v2DataUrl = bufferToDataUrl(bytes);

      expect(isDataUrl(v2DataUrl)).toBe(true);
      expect(v2DataUrl).toMatch(/^data:application\/octet-stream/);

      // Verify we can decode it back
      const decodedBuffer = await dataUrlToBuffer(v2DataUrl);
      const decodedArray = new Uint8Array(decodedBuffer);
      expect(decodedArray).toEqual(originalData);
    });
  });

  describe("dereferenceDataRefs should handle mixed v1 and v2 refs", () => {
    it("should dereference only v2 data URLs, not v1 objects", async () => {
      const v1Ref: DataRef = {
        ref: DataRefType.utf8,
        value: "v1 text",
      };

      const v2DataUrl = textToDataUrl("v2 text");

      const input = {
        v1Data: v1Ref,
        v2Data: v2DataUrl,
        regular: "normal string",
      };

      const result = await dereferenceDataRefs(input);

      // v2 should be dereferenced
      expect(result.v2Data).toBe("v2 text");

      // v1 should remain as-is (object)
      expect(result.v1Data).toEqual(v1Ref);

      // Regular strings should remain unchanged
      expect(result.regular).toBe("normal string");
    });

    it("should handle nested structures with mixed v1/v2 refs", async () => {
      const v1Ref: DataRef = {
        ref: DataRefType.json,
        value: { nested: "v1 data" },
      };

      const v2DataUrl = jsonToDataUrl({ nested: "v2 data" });

      const input = {
        level1: {
          v1: v1Ref,
          v2: v2DataUrl,
        },
        items: [v1Ref, v2DataUrl, "regular"],
      };

      const result = await dereferenceDataRefs(input);

      // v1 refs should remain as objects
      expect(result.level1.v1).toEqual(v1Ref);
      expect(result.items[0]).toEqual(v1Ref);

      // v2 refs should be dereferenced
      expect(result.level1.v2).toEqual({ nested: "v2 data" });
      expect(result.items[1]).toEqual({ nested: "v2 data" });

      // Regular values unchanged
      expect(result.items[2]).toBe("regular");
    });
  });

  describe("v2 data URLs maintain advantages over v1", () => {
    it("v2 data URLs are unambiguous strings, not objects", () => {
      const v1Ref: DataRef = {
        ref: DataRefType.utf8,
        value: "hello",
      };

      const v2DataUrl = textToDataUrl("hello");

      // v1 is an object that could be mistaken for other data
      expect(typeof v1Ref).toBe("object");
      expect(v1Ref.ref).toBeDefined();

      // v2 is a string that clearly starts with "data:"
      expect(typeof v2DataUrl).toBe("string");
      expect(v2DataUrl.startsWith("data:")).toBe(true);
    });

    it("v2 data URLs work in URL parameters directly", () => {
      const text = "Hello, World!";
      const v2DataUrl = textToDataUrl(text);

      // Can be used directly in URL parameters
      const url = new URL("https://example.com");
      url.searchParams.set("data", v2DataUrl);

      expect(url.searchParams.get("data")).toBe(v2DataUrl);
      expect(url.searchParams.get("data")?.startsWith("data:")).toBe(true);
    });

    it("v2 data URLs can be embedded in JSON without confusion", () => {
      const v2DataUrl = textToDataUrl("embedded data");

      const json = {
        normalString: "regular",
        dataRef: v2DataUrl,
        normalObject: { key: "value" },
      };

      const jsonString = JSON.stringify(json);
      const parsed = JSON.parse(jsonString);

      // The data URL is preserved as a string
      expect(isDataUrl(parsed.dataRef)).toBe(true);

      // Can clearly distinguish it from regular strings
      expect(isDataUrl(parsed.normalString)).toBe(false);
      expect(isDataUrl(parsed.normalObject)).toBe(false);
    });
  });

  describe("Backwards compatibility scenarios", () => {
    it("should handle data structures that might contain v1 refs", async () => {
      // A realistic scenario where old data (v1) and new data (v2) coexist
      const legacyData = {
        oldFormat: {
          ref: DataRefType.utf8,
          value: "This is v1 format data",
        } as DataRef,
        metadata: "created with v1",
      };

      const modernData = {
        newFormat: textToDataUrl("This is v2 format data"),
        metadata: "created with v2",
      };

      const combined = {
        legacy: legacyData,
        modern: modernData,
      };

      const result = await dereferenceDataRefs(combined);

      // v1 data preserved as-is
      expect(result.legacy.oldFormat).toEqual(legacyData.oldFormat);

      // v2 data dereferenced
      expect(result.modern.newFormat).toBe("This is v2 format data");

      // Metadata unchanged
      expect(result.legacy.metadata).toBe("created with v1");
      expect(result.modern.metadata).toBe("created with v2");
    });

    it("should allow gradual migration from v1 to v2", () => {
      // Start with v1 data
      const v1Data: DataRef = {
        ref: DataRefType.json,
        value: { user: "john", score: 100 },
      };

      // Can check if it's a v1 ref
      expect(isDataRefV1(v1Data)).toBe(true);
      expect(isDataUrl(v1Data)).toBe(false);

      // Migrate to v2
      const v2Data = jsonToDataUrl(v1Data.value);

      // Check it's now v2
      expect(isDataUrl(v2Data)).toBe(true);
      expect(isDataRefV1(v2Data)).toBe(false);

      // Both are recognized as datarefs by the unified function
      expect(isDataRef(v1Data)).toBe(true);
      expect(isDataRef(v2Data)).toBe(true);
    });
  });
});
