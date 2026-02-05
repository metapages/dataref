/**
 * Example demonstrating the primary serialize/deserialize API
 */
import {
  serializeDataRefs,
  deserializeDataRefs,
  type SerializeOptions,
} from "../src/index";

async function basicExample() {
  console.log("=== Basic Serialize/Deserialize Example ===\n");

  // Create data with various binary types
  const originalData = {
    metadata: {
      name: "Sensor Data",
      timestamp: new Date().toISOString(),
    },
    readings: {
      temperature: new Float32Array([20.5, 21.2, 22.1, 21.8]),
      humidity: new Uint8Array([65, 68, 70, 69]),
      rawData: new Int16Array([-100, -50, 0, 50, 100]),
    },
    buffer: new Uint8Array([0xff, 0x00, 0x80]).buffer,
    blob: new Blob(["Sample text content"], { type: "text/plain" }),
    file: new File(["Document content"], "report.txt", { type: "text/plain" }),
    regularString: "This stays as a regular string",
    regularNumber: 42,
  };

  console.log("Original data structure:");
  console.log("- temperature:", originalData.readings.temperature.constructor.name);
  console.log("- humidity:", originalData.readings.humidity.constructor.name);
  console.log("- rawData:", originalData.readings.rawData.constructor.name);
  console.log("- buffer:", originalData.buffer.constructor.name);
  console.log("- blob:", originalData.blob.constructor.name);
  console.log("- file:", originalData.file.constructor.name);
  console.log();

  // Serialize - convert all binary types to dataref strings
  console.log("Serializing...");
  const serialized = await serializeDataRefs(originalData);

  console.log("\nSerialized data (binary types are now strings):");
  console.log("- temperature:", typeof serialized.readings.temperature,
              serialized.readings.temperature.substring(0, 50) + "...");
  console.log("- humidity:", typeof serialized.readings.humidity,
              serialized.readings.humidity.substring(0, 50) + "...");
  console.log("- buffer:", typeof serialized.buffer,
              serialized.buffer.substring(0, 50) + "...");
  console.log("- regularString:", typeof serialized.regularString, "=", serialized.regularString);
  console.log();

  // Can now safely stringify as JSON
  const jsonString = JSON.stringify(serialized);
  console.log("JSON size:", jsonString.length, "bytes");
  console.log();

  // Deserialize - convert all datarefs back to original types
  console.log("Deserializing...");
  const deserialized = await deserializeDataRefs(JSON.parse(jsonString));

  console.log("\nDeserialized data (restored to original types):");
  console.log("- temperature:", deserialized.readings.temperature.constructor.name, "=",
              Array.from(deserialized.readings.temperature));
  console.log("- humidity:", deserialized.readings.humidity.constructor.name, "=",
              Array.from(deserialized.readings.humidity));
  console.log("- rawData:", deserialized.readings.rawData.constructor.name, "=",
              Array.from(deserialized.readings.rawData));
  console.log("- buffer:", deserialized.buffer.constructor.name);
  console.log("- blob:", deserialized.blob.constructor.name, "type:", deserialized.blob.type);
  console.log("- regularString:", deserialized.regularString);
  console.log("- regularNumber:", deserialized.regularNumber);
  console.log();
}

async function uploadDownloadExample() {
  console.log("=== Upload/Download Example ===\n");

  // Simulate cloud storage
  const mockStorage = new Map<string, ArrayBuffer>();
  let uploadCounter = 0;

  // Mock upload function
  const mockUploadFn = async (
    data: Blob | ArrayBuffer,
    metadata: { type: string; size: number; mimeType?: string }
  ): Promise<string> => {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const url = `https://storage.example.com/uploads/file-${++uploadCounter}`;
    mockStorage.set(url, buffer);
    console.log(`  ✓ Uploaded ${metadata.size} bytes (${metadata.type}) to ${url}`);
    return url;
  };

  // Mock download function
  const mockDownloadFn = async (url: string): Promise<ArrayBuffer> => {
    const data = mockStorage.get(url);
    if (!data) {
      throw new Error(`URL not found: ${url}`);
    }
    console.log(`  ✓ Downloaded ${data.byteLength} bytes from ${url}`);
    return data;
  };

  // Create data with a large array that should be uploaded
  const largeArray = new Float32Array(50000); // 200KB
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = Math.sin(i / 100);
  }

  const data = {
    smallData: new Uint8Array([1, 2, 3, 4, 5]),
    largeData: largeArray,
    metadata: {
      description: "Signal processing results",
      samples: largeArray.length,
    },
  };

  // Serialize with upload for large objects
  console.log("Serializing with upload (threshold: 10KB)...");
  const serialized = await serializeDataRefs(data, {
    uploadFn: mockUploadFn,
    maxSizeBytes: 10240, // 10KB threshold
  });
  console.log();

  console.log("Result:");
  console.log("- smallData: inline dataref (small, not uploaded)");
  console.log("- largeData: URL dataref (uploaded)");
  console.log();

  // JSON is now much smaller
  const jsonString = JSON.stringify(serialized);
  console.log("JSON size:", jsonString.length, "bytes (instead of ~200KB)");
  console.log();

  // Deserialize with download
  console.log("Deserializing with download...");
  const deserialized = await deserializeDataRefs(serialized, {
    downloadFn: mockDownloadFn,
  });
  console.log();

  console.log("Verification:");
  console.log("- smallData matches:",
    JSON.stringify(Array.from(deserialized.smallData)) === JSON.stringify([1, 2, 3, 4, 5]));
  console.log("- largeData length:", deserialized.largeData.length);
  console.log("- largeData type:", deserialized.largeData.constructor.name);
  console.log("- First 5 values:", Array.from(deserialized.largeData.slice(0, 5)));
  console.log();
}

// Run examples
(async () => {
  try {
    await basicExample();
    await uploadDownloadExample();
    console.log("✓ All examples completed successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
