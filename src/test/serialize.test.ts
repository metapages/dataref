import { describe, it, expect } from "vitest";
import {
  serializeDataRefs,
  deserializeDataRefs,
  type SerializeOptions,
} from "../index";

describe("Primary Serialize/Deserialize API", () => {
  describe("serializeDataRefs", () => {
    it("should convert TypedArray to dataref string", async () => {
      const input = {
        data: new Uint8Array([1, 2, 3, 4, 5]),
        name: "test",
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.name).toBe("test");
      expect(typeof serialized.data).toBe("string");
      expect(serialized.data).toMatch(/^data:/);
      expect(serialized.data).toContain("type=Uint8Array");
    });

    it("should convert ArrayBuffer to dataref string", async () => {
      const buffer = new Uint8Array([10, 20, 30]).buffer;
      const input = {
        buffer,
        other: "value",
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.other).toBe("value");
      expect(typeof serialized.buffer).toBe("string");
      expect(serialized.buffer).toMatch(/^data:/);
    });

    it("should convert Blob to dataref string", async () => {
      const blob = new Blob(["hello blob"], { type: "text/plain" });
      const input = {
        blob,
        count: 42,
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.count).toBe(42);
      expect(typeof serialized.blob).toBe("string");
      expect(serialized.blob).toMatch(/^data:/);
      expect(serialized.blob).toContain("text/plain");
    });

    it("should convert File to dataref string", async () => {
      const file = new File(["file content"], "test.txt", { type: "text/plain" });
      const input = {
        file,
        id: 123,
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.id).toBe(123);
      expect(typeof serialized.file).toBe("string");
      expect(serialized.file).toMatch(/^data:/);
    });

    it("should handle mixed binary types", async () => {
      const input = {
        array: new Float32Array([1.1, 2.2, 3.3]),
        buffer: new Uint8Array([255, 0, 128]).buffer,
        blob: new Blob(["test"], { type: "text/plain" }),
        file: new File(["content"], "doc.txt"),
        string: "regular string",
        number: 42,
        nested: {
          innerArray: new Int16Array([100, -100]),
          innerString: "nested value",
        },
      };

      const serialized = await serializeDataRefs(input);

      // Check regular values are unchanged
      expect(serialized.string).toBe("regular string");
      expect(serialized.number).toBe(42);
      expect(serialized.nested.innerString).toBe("nested value");

      // Check binary types are converted
      expect(typeof serialized.array).toBe("string");
      expect(serialized.array).toContain("type=Float32Array");

      expect(typeof serialized.buffer).toBe("string");
      expect(serialized.buffer).toMatch(/^data:/);

      expect(typeof serialized.blob).toBe("string");
      expect(serialized.blob).toContain("text/plain");

      expect(typeof serialized.file).toBe("string");
      expect(serialized.file).toMatch(/^data:/);

      expect(typeof serialized.nested.innerArray).toBe("string");
      expect(serialized.nested.innerArray).toContain("type=Int16Array");
    });

    it("should handle arrays with binary types", async () => {
      const input = {
        items: [
          new Uint8Array([1, 2, 3]),
          "string",
          new Blob(["blob"]),
          42,
          new Float32Array([1.5, 2.5]),
        ],
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.items.length).toBe(5);
      expect(typeof serialized.items[0]).toBe("string");
      expect(serialized.items[0]).toContain("type=Uint8Array");
      expect(serialized.items[1]).toBe("string");
      expect(typeof serialized.items[2]).toBe("string");
      expect(serialized.items[2]).toMatch(/^data:/);
      expect(serialized.items[3]).toBe(42);
      expect(typeof serialized.items[4]).toBe("string");
      expect(serialized.items[4]).toContain("type=Float32Array");
    });

    it("should handle empty/null/undefined values", async () => {
      const input = {
        empty: new Uint8Array([]),
        nullValue: null,
        undefinedValue: undefined,
        emptyString: "",
      };

      const serialized = await serializeDataRefs(input);

      expect(typeof serialized.empty).toBe("string");
      expect(serialized.nullValue).toBe(null);
      expect(serialized.undefinedValue).toBe(undefined);
      expect(serialized.emptyString).toBe("");
    });

    it("should not convert existing dataref strings", async () => {
      const existingDataRef = "data:text/plain;charset=utf-8,existing";
      const input = {
        existing: existingDataRef,
        new: new Uint8Array([1, 2, 3]),
      };

      const serialized = await serializeDataRefs(input);

      expect(serialized.existing).toBe(existingDataRef);
      expect(typeof serialized.new).toBe("string");
      expect(serialized.new).not.toBe(existingDataRef);
    });

    it("should support upload for large binary data", async () => {
      const largeArray = new Uint8Array(100000); // 100KB
      for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = i % 256;
      }

      const mockUploadFn = async (
        data: Blob | ArrayBuffer,
        metadata: { type: string; size: number }
      ): Promise<string> => {
        expect(metadata.size).toBeGreaterThan(10000);
        expect(metadata.type).toBe("Uint8Array");
        return `https://storage.example.com/uploads/${Date.now()}`;
      };

      const input = {
        largeData: largeArray,
        smallData: new Uint8Array([1, 2, 3]),
      };

      const options: SerializeOptions = {
        uploadFn: mockUploadFn,
        maxSizeBytes: 10240, // 10KB threshold
      };

      const serialized = await serializeDataRefs(input, options);

      // Large data should be uploaded (URL dataref)
      expect(typeof serialized.largeData).toBe("string");
      expect(serialized.largeData).toContain("text/x-uri");
      // URL is encoded in the dataref
      expect(decodeURIComponent(serialized.largeData)).toContain("https://storage.example.com");

      // Small data should be inline
      expect(typeof serialized.smallData).toBe("string");
      expect(serialized.smallData).toContain("type=Uint8Array");
      expect(serialized.smallData).not.toContain("text/x-uri");
    });

    it("should preserve MIME type in upload metadata for Blobs", async () => {
      const blob = new Blob(["content"], { type: "application/json" });

      const mockUploadFn = async (
        data: Blob | ArrayBuffer,
        metadata: { type: string; size: number; mimeType?: string }
      ): Promise<string> => {
        expect(metadata.mimeType).toBe("application/json");
        expect(metadata.type).toBe("Blob");
        return "https://storage.example.com/blob";
      };

      const input = { blob };

      const options: SerializeOptions = {
        uploadFn: mockUploadFn,
        maxSizeBytes: 1, // Force upload
      };

      const serialized = await serializeDataRefs(input, options);
      expect(serialized.blob).toContain("mimeType=application/json");
    });
  });

  describe("deserializeDataRefs", () => {
    it("should convert dataref string back to TypedArray", async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const serialized = await serializeDataRefs({ data: original });
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.data).toEqual(original);
      expect(deserialized.data).toBeInstanceOf(Uint8Array);
    });

    it("should convert dataref string back to ArrayBuffer", async () => {
      const original = new Uint8Array([10, 20, 30]).buffer;
      const serialized = await serializeDataRefs({ buffer: original });
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.buffer).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(deserialized.buffer)).toEqual(new Uint8Array([10, 20, 30]));
    });

    it("should convert dataref string back to Blob", async () => {
      const original = new Blob(["hello blob"], { type: "text/plain" });
      const serialized = await serializeDataRefs({ blob: original });
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.blob).toBeInstanceOf(Blob);
      expect(deserialized.blob.type).toBe("text/plain");
      expect(await deserialized.blob.text()).toBe("hello blob");
    });

    it("should perform full round-trip for all binary types", async () => {
      const original = {
        uint8: new Uint8Array([1, 2, 3]),
        int16: new Int16Array([-100, 0, 100]),
        float32: new Float32Array([1.1, 2.2, 3.3]),
        buffer: new Uint8Array([255, 128, 0]).buffer,
        blob: new Blob(["blob content"], { type: "text/plain" }),
        string: "regular",
        number: 42,
        nested: {
          array: new Uint32Array([1000, 2000]),
          value: "nested",
        },
      };

      const serialized = await serializeDataRefs(original);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.uint8).toEqual(original.uint8);
      expect(deserialized.int16).toEqual(original.int16);
      expect(deserialized.float32).toEqual(original.float32);
      expect(new Uint8Array(deserialized.buffer)).toEqual(new Uint8Array([255, 128, 0]));
      expect(deserialized.blob).toBeInstanceOf(Blob);
      expect(await deserialized.blob.text()).toBe("blob content");
      expect(deserialized.string).toBe("regular");
      expect(deserialized.number).toBe(42);
      expect(deserialized.nested.array).toEqual(original.nested.array);
      expect(deserialized.nested.value).toBe("nested");
    });

    it("should handle arrays with mixed types", async () => {
      const original = {
        items: [
          new Uint8Array([1, 2, 3]),
          "string",
          42,
          new Float32Array([1.5]),
        ],
      };

      const serialized = await serializeDataRefs(original);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.items[0]).toEqual(original.items[0]);
      expect(deserialized.items[1]).toBe("string");
      expect(deserialized.items[2]).toBe(42);
      expect(deserialized.items[3]).toEqual(original.items[3]);
    });

    it("should handle empty values", async () => {
      const original = {
        empty: new Uint8Array([]),
        nullValue: null,
        undefinedValue: undefined,
      };

      const serialized = await serializeDataRefs(original);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.empty).toEqual(new Uint8Array([]));
      expect(deserialized.nullValue).toBe(null);
      expect(deserialized.undefinedValue).toBe(undefined);
    });

    it("should preserve TypedArray types exactly", async () => {
      const types = {
        int8: new Int8Array([-128, 0, 127]),
        uint8: new Uint8Array([0, 128, 255]),
        int16: new Int16Array([-32768, 0, 32767]),
        uint16: new Uint16Array([0, 32768, 65535]),
        int32: new Int32Array([-2147483648, 0, 2147483647]),
        uint32: new Uint32Array([0, 2147483648, 4294967295]),
        float32: new Float32Array([1.1, 2.2, 3.3]),
        float64: new Float64Array([1.1, 2.2, 3.3]),
        uint8clamped: new Uint8ClampedArray([0, 128, 255]),
      };

      const serialized = await serializeDataRefs(types);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.int8.constructor.name).toBe("Int8Array");
      expect(deserialized.uint8.constructor.name).toBe("Uint8Array");
      expect(deserialized.int16.constructor.name).toBe("Int16Array");
      expect(deserialized.uint16.constructor.name).toBe("Uint16Array");
      expect(deserialized.int32.constructor.name).toBe("Int32Array");
      expect(deserialized.uint32.constructor.name).toBe("Uint32Array");
      expect(deserialized.float32.constructor.name).toBe("Float32Array");
      expect(deserialized.float64.constructor.name).toBe("Float64Array");
      expect(deserialized.uint8clamped.constructor.name).toBe("Uint8ClampedArray");
    });

    it("should support custom download function for URL datarefs", async () => {
      // Simulate uploaded data
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockStorage = new Map<string, ArrayBuffer>();

      const uploadUrl = "https://storage.example.com/data123";
      mockStorage.set(uploadUrl, originalData.buffer);

      // Create a URL dataref manually
      const urlDataRef = `data:text/x-uri;type=Uint8Array;charset=utf-8,${encodeURIComponent(uploadUrl)}`;

      const input = {
        uploaded: urlDataRef,
        inline: "data:application/octet-stream;type=Uint8Array;base64,AQIDBAU=",
      };

      const mockDownloadFn = async (url: string): Promise<ArrayBuffer> => {
        const data = mockStorage.get(url);
        if (!data) {
          throw new Error(`URL not found: ${url}`);
        }
        return data;
      };

      const deserialized = await deserializeDataRefs(input, {
        downloadFn: mockDownloadFn,
      });

      expect(deserialized.uploaded).toEqual(originalData);
      expect(deserialized.inline).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it("should handle upload and download round-trip", async () => {
      const mockStorage = new Map<string, ArrayBuffer>();
      let uploadCounter = 0;

      const mockUploadFn = async (
        data: Blob | ArrayBuffer
      ): Promise<string> => {
        const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const url = `https://storage.example.com/file${++uploadCounter}`;
        mockStorage.set(url, buffer);
        return url;
      };

      const mockDownloadFn = async (url: string): Promise<ArrayBuffer> => {
        const data = mockStorage.get(url);
        if (!data) {
          throw new Error(`URL not found: ${url}`);
        }
        return data;
      };

      const original = {
        smallArray: new Uint8Array([1, 2, 3]),
        largeArray: new Uint8Array(20000).fill(42),
        string: "unchanged",
      };

      // Serialize with upload
      const serialized = await serializeDataRefs(original, {
        uploadFn: mockUploadFn,
        maxSizeBytes: 1000,
      });

      // Small array should be inline, large should be URL
      expect(serialized.smallArray).toContain("base64");
      expect(serialized.largeArray).toContain("text/x-uri");
      expect(serialized.largeArray).toContain("storage.example.com");

      // Deserialize with download
      const deserialized = await deserializeDataRefs(serialized, {
        downloadFn: mockDownloadFn,
      });

      expect(deserialized.smallArray).toEqual(original.smallArray);
      expect(deserialized.largeArray).toEqual(original.largeArray);
      expect(deserialized.string).toBe("unchanged");
    });
  });

  describe("Edge cases", () => {
    it("should handle deeply nested structures", async () => {
      const original = {
        level1: {
          level2: {
            level3: {
              level4: {
                data: new Uint8Array([99, 100, 101]),
              },
            },
          },
        },
      };

      const serialized = await serializeDataRefs(original);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized.level1.level2.level3.level4.data).toEqual(
        original.level1.level2.level3.level4.data
      );
    });

    it("should handle objects with no binary types", async () => {
      const original = {
        name: "test",
        count: 42,
        nested: {
          value: "string",
          array: [1, 2, 3],
        },
      };

      const serialized = await serializeDataRefs(original);
      const deserialized = await deserializeDataRefs(serialized);

      expect(deserialized).toEqual(original);
    });

    it("should return input unchanged if no binary types found", async () => {
      const original = { a: 1, b: "test", c: [1, 2, 3] };
      const serialized = await serializeDataRefs(original);
      expect(serialized).toBe(original); // Should be same reference
    });
  });
});
