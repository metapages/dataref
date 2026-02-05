import { describe, it, expect } from "vitest";
import {
  convertLargeObjectsToDataRefs,
  dereferenceDataRefs,
  isDataUrl,
  dataUrlToUrl,
} from "../index";

// Mock upload server that generates SHA-based URLs
class MockUploadServer {
  private storage = new Map<string, string>();

  async upload(data: string, originalType: string): Promise<string> {
    // Generate SHA-256 hash of the data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Store the data
    this.storage.set(sha, data);

    // Return a URL with the SHA as the ID
    return `https://storage.example.com/uploads/${sha}`;
  }

  async download(url: string): Promise<{ data: string; found: boolean }> {
    const sha = url.split("/").pop();
    if (!sha) {
      return { data: "", found: false };
    }

    const data = this.storage.get(sha);
    if (!data) {
      return { data: "", found: false };
    }

    return { data, found: true };
  }

  getStorageSize(): number {
    return this.storage.size;
  }

  clear(): void {
    this.storage.clear();
  }
}

describe("convertLargeObjectsToDataRefs", () => {
  describe("Basic functionality", () => {
    it("should not convert small objects", async () => {
      const server = new MockUploadServer();
      const input = {
        small: { value: "tiny" },
        number: 42,
        string: "hello",
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        1000, // 1KB threshold
        (data, type) => server.upload(data, type)
      );

      expect(result).toEqual(input);
      expect(server.getStorageSize()).toBe(0);
    });

    it("should convert large objects to datarefs", async () => {
      const server = new MockUploadServer();
      const largeData = {
        description: "Large object with lots of data",
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
        })),
      };

      const input = {
        metadata: { version: 1 },
        largeData,
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        100, // 100 bytes threshold
        (data, type) => server.upload(data, type)
      );

      // Metadata should remain unchanged
      expect(result.metadata).toEqual({ version: 1 });

      // Large data should be converted to a data URL
      expect(typeof result.largeData).toBe("string");
      expect(isDataUrl(result.largeData as unknown as string)).toBe(true);

      // Should have uploaded to server
      expect(server.getStorageSize()).toBe(1);

      // Extract and verify the URL
      const dataUrl = result.largeData as unknown as string;
      const url = dataUrlToUrl(dataUrl);
      expect(url).toContain("https://storage.example.com/uploads/");
    });

    it("should preserve original type information in dataref", async () => {
      const server = new MockUploadServer();
      const largeArray = Array.from({ length: 50 }, (_, i) => i);

      const input = {
        data: largeArray,
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        50, // Small threshold
        (data, type) => server.upload(data, type)
      );

      const dataUrl = result.data as unknown as string;
      expect(dataUrl).toContain("type=array");
    });

    it("should handle nested large objects", async () => {
      const server = new MockUploadServer();
      const largeNested = {
        level1: {
          level2: {
            data: Array.from({ length: 100 }, (_, i) => i),
          },
        },
      };

      const input = {
        root: largeNested,
        small: "value",
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        100,
        (data, type) => server.upload(data, type)
      );

      expect(result.small).toBe("value");
      expect(typeof result.root).toBe("string");
      expect(isDataUrl(result.root as unknown as string)).toBe(true);
      expect(server.getStorageSize()).toBe(1);
    });

    it("should handle multiple large objects", async () => {
      const server = new MockUploadServer();
      const large1 = { data: Array.from({ length: 100 }, () => "x") };
      const large2 = { data: Array.from({ length: 100 }, () => "y") };
      const large3 = { data: Array.from({ length: 100 }, () => "z") };

      const input = {
        obj1: large1,
        obj2: large2,
        obj3: large3,
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        100,
        (data, type) => server.upload(data, type)
      );

      expect(isDataUrl(result.obj1 as unknown as string)).toBe(true);
      expect(isDataUrl(result.obj2 as unknown as string)).toBe(true);
      expect(isDataUrl(result.obj3 as unknown as string)).toBe(true);
      expect(server.getStorageSize()).toBe(3);

      // Each should have a different URL (different SHA)
      const url1 = dataUrlToUrl(result.obj1 as unknown as string);
      const url2 = dataUrlToUrl(result.obj2 as unknown as string);
      const url3 = dataUrlToUrl(result.obj3 as unknown as string);
      expect(url1).not.toBe(url2);
      expect(url2).not.toBe(url3);
      expect(url1).not.toBe(url3);
    });

    it("should not process existing datarefs", async () => {
      const server = new MockUploadServer();
      const existingDataUrl = "data:text/plain,hello";

      const input = {
        existing: existingDataUrl,
        large: { data: Array.from({ length: 100 }, () => "x") },
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        100,
        (data, type) => server.upload(data, type)
      );

      // Existing dataref should remain unchanged
      expect(result.existing).toBe(existingDataUrl);

      // Large object should be converted
      expect(isDataUrl(result.large as unknown as string)).toBe(true);
      expect(server.getStorageSize()).toBe(1);
    });
  });

  describe("Integration with dereferenceDataRefs", () => {
    it("should round-trip: convert then dereference", async () => {
      const server = new MockUploadServer();
      const originalData = {
        metadata: { version: 1 },
        largeObject: {
          description: "Large dataset",
          values: Array.from({ length: 100 }, (_, i) => i),
        },
        small: "unchanged",
      };

      // Step 1: Convert large objects to refs
      const converted = await convertLargeObjectsToDataRefs(
        originalData,
        100,
        (data, type) => server.upload(data, type)
      );

      // Verify conversion happened
      expect(typeof converted.largeObject).toBe("string");
      expect(converted.small).toBe("unchanged");

      // Step 2: Mock dereferencing by downloading from server
      // In a real scenario, dereferenceDataRefs would fetch from the URL
      const dataUrl = converted.largeObject as unknown as string;
      const url = dataUrlToUrl(dataUrl);
      expect(url).not.toBeNull();

      const { data: downloadedData, found } = await server.download(url!);
      expect(found).toBe(true);

      const reconstructed = JSON.parse(downloadedData);
      expect(reconstructed).toEqual(originalData.largeObject);
    });

    it("should handle multiple round-trips", async () => {
      const server = new MockUploadServer();
      const data = {
        level1: {
          level2: {
            largeData: Array.from({ length: 50 }, (_, i) => ({
              id: i,
              value: i * 2,
            })),
          },
        },
      };

      // Convert
      const converted = await convertLargeObjectsToDataRefs(
        data,
        100,
        (data, type) => server.upload(data, type)
      );

      // Verify
      expect(typeof converted.level1).toBe("string");

      // Download and reconstruct
      const url = dataUrlToUrl(converted.level1 as unknown as string);
      const { data: downloaded } = await server.download(url!);
      const reconstructed = JSON.parse(downloaded);

      expect(reconstructed).toEqual(data.level1);
    });
  });

  describe("Type preservation", () => {
    it("should preserve object type", async () => {
      const server = new MockUploadServer();
      const input = {
        data: { large: Array.from({ length: 100 }, () => "x") },
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        50,
        (data, type) => server.upload(data, type)
      );

      const dataUrl = result.data as unknown as string;
      expect(dataUrl).toContain("type=object");
    });

    it("should preserve array type", async () => {
      const server = new MockUploadServer();
      const input = {
        data: Array.from({ length: 100 }, () => "x"),
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        50,
        (data, type) => server.upload(data, type)
      );

      const dataUrl = result.data as unknown as string;
      expect(dataUrl).toContain("type=array");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty objects", async () => {
      const server = new MockUploadServer();
      const input = {};

      const result = await convertLargeObjectsToDataRefs(
        input,
        100,
        (data, type) => server.upload(data, type)
      );

      expect(result).toEqual({});
      expect(server.getStorageSize()).toBe(0);
    });

    it("should handle null and undefined values", async () => {
      const server = new MockUploadServer();
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        large: { data: Array.from({ length: 100 }, () => "x") },
      };

      const result = await convertLargeObjectsToDataRefs(
        input,
        50,
        (data, type) => server.upload(data, type)
      );

      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(isDataUrl(result.large as unknown as string)).toBe(true);
    });

    it("should handle primitives at root level", async () => {
      const server = new MockUploadServer();

      const stringResult = await convertLargeObjectsToDataRefs(
        "simple string",
        100,
        (data, type) => server.upload(data, type)
      );

      const numberResult = await convertLargeObjectsToDataRefs(
        42,
        100,
        (data, type) => server.upload(data, type)
      );

      expect(stringResult).toBe("simple string");
      expect(numberResult).toBe(42);
      expect(server.getStorageSize()).toBe(0);
    });

    it("should generate consistent SHAs for identical data", async () => {
      const server = new MockUploadServer();
      const data = { values: Array.from({ length: 50 }, (_, i) => i) };

      const input1 = { data: { ...data } };
      const input2 = { data: { ...data } };

      const result1 = await convertLargeObjectsToDataRefs(
        input1,
        50,
        (data, type) => server.upload(data, type)
      );

      const result2 = await convertLargeObjectsToDataRefs(
        input2,
        50,
        (data, type) => server.upload(data, type)
      );

      // Same data should generate same SHA/URL
      expect(result1.data).toBe(result2.data);

      // But server should only store it once (SHA-based deduplication)
      expect(server.getStorageSize()).toBe(1);
    });
  });

  describe("Performance", () => {
    it("should process multiple large objects in parallel", async () => {
      const server = new MockUploadServer();
      const uploadTimes: number[] = [];

      const slowUpload = async (
        data: string,
        type: string
      ): Promise<string> => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
        const url = await server.upload(data, type);
        uploadTimes.push(Date.now() - start);
        return url;
      };

      const large1 = { data: Array.from({ length: 100 }, () => "x") };
      const large2 = { data: Array.from({ length: 100 }, () => "y") };
      const large3 = { data: Array.from({ length: 100 }, () => "z") };

      const input = { obj1: large1, obj2: large2, obj3: large3 };

      const start = Date.now();
      await convertLargeObjectsToDataRefs(input, 50, slowUpload);
      const totalTime = Date.now() - start;

      // If parallel, total time should be ~10ms (one delay)
      // If sequential, total time would be ~30ms (three delays)
      // Allow some margin for test execution overhead
      expect(totalTime).toBeLessThan(25);
      expect(uploadTimes.length).toBe(3);
    });
  });
});
