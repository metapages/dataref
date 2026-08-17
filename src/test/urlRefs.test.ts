import { describe, it, expect, afterEach } from "vitest";
import {
  convertLargeObjectsToDataRefs,
  dereferenceDataRefs,
  deserializeDataRefs,
  getMimeType,
  isUrlDataUrl,
  serializeDataRefs,
  urlToDataUrl,
} from "../index";

const REF_URL = "https://metapage.io/f/bc1082dc-e276-4caa-abd1-576de181c604";
const realFetch = globalThis.fetch;

/** Serve fixed bytes for every request, recording the URLs asked for. */
const stubFetch = (
  body: BodyInit,
  headers: Record<string, string> = {}
): { urls: string[] } => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    urls.push(typeof input === "string" ? input : input.url);
    return new Response(body, { status: 200, headers });
  }) as typeof fetch;
  return { urls };
};

/** Serve whatever a mock upload server stored, keyed by URL. */
const stubFetchFromStore = (store: Map<string, string>): void => {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const data = store.get(url);
    return data === undefined
      ? new Response("", { status: 404, statusText: "Not Found" })
      : new Response(data, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
  }) as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("getMimeType with no parameters", () => {
  it("stops at the payload comma", () => {
    expect(getMimeType("data:text/x-uri,https%3A%2F%2Fexample.com")).toBe(
      "text/x-uri"
    );
    expect(getMimeType("data:text/plain,hello")).toBe("text/plain");
    expect(getMimeType("data:application/json,{}")).toBe("application/json");
  });

  it("still stops at the first parameter when there is one", () => {
    expect(getMimeType("data:text/x-uri;charset=utf-8,x")).toBe("text/x-uri");
    expect(getMimeType("data:application/octet-stream;base64,AAA=")).toBe(
      "application/octet-stream"
    );
  });

  it("recognises a parameterless url dataref", () => {
    expect(isUrlDataUrl("data:text/x-uri,https%3A%2F%2Fexample.com")).toBe(true);
  });
});

describe("dereferencing url datarefs that carry no type parameter", () => {
  it("fetches a ref built by urlToDataUrl instead of leaving it opaque", async () => {
    const { urls } = stubFetch("file contents", {
      "content-type": "text/csv",
    });
    const dataUrl = await urlToDataUrl(REF_URL);

    const result = await dereferenceDataRefs({ file: dataUrl });

    expect(urls).toEqual([REF_URL]);
    expect(result.file).toBe("file contents");
  });

  it("parses the response when it is json", async () => {
    stubFetch(JSON.stringify({ a: [1, 2] }), {
      "content-type": "application/json; charset=utf-8",
    });
    const result = await dereferenceDataRefs({
      file: await urlToDataUrl(REF_URL),
    });
    expect(result.file).toEqual({ a: [1, 2] });
  });

  it("returns an ArrayBuffer for binary responses", async () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    stubFetch(bytes, { "content-type": "application/octet-stream" });
    const result = await dereferenceDataRefs({
      file: await urlToDataUrl(REF_URL),
    });
    expect(result.file).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result.file as unknown as ArrayBuffer)).toEqual(bytes);
  });

  it("returns an ArrayBuffer when the response says nothing", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    stubFetch(bytes);
    const result = await dereferenceDataRefs({
      file: await urlToDataUrl(REF_URL),
    });
    expect(result.file).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result.file as unknown as ArrayBuffer)).toEqual(bytes);
  });
});

describe("dereferencing url datarefs that record a type", () => {
  it("rebuilds a TypedArray", async () => {
    const original = new Float32Array([1.5, 2.5, 3.5]);
    stubFetch(original.buffer as ArrayBuffer);
    const dataUrl = `data:text/x-uri;type=Float32Array;charset=utf-8,${encodeURIComponent(
      REF_URL
    )}`;

    const result = await dereferenceDataRefs({ data: dataUrl });

    expect(result.data).toBeInstanceOf(Float32Array);
    expect(Array.from(result.data as unknown as Float32Array)).toEqual([
      1.5, 2.5, 3.5,
    ]);
  });

  it("rebuilds a Blob with its recorded mime type", async () => {
    stubFetch("hello");
    const dataUrl = `data:text/x-uri;type=Blob;mimeType=text/plain;charset=utf-8,${encodeURIComponent(
      REF_URL
    )}`;

    const result = await dereferenceDataRefs({ data: dataUrl });

    expect(result.data).toBeInstanceOf(Blob);
    expect((result.data as unknown as Blob).type).toBe("text/plain");
  });

  it("does not treat a non-TypedArray constructor name as a TypedArray", async () => {
    stubFetch(JSON.stringify([1, 2, 3]));
    const dataUrl = `data:text/x-uri;type=array;charset=utf-8,${encodeURIComponent(
      REF_URL
    )}`;

    const result = await dereferenceDataRefs({ data: dataUrl });

    expect(result.data).toEqual([1, 2, 3]);
  });
});

describe("convertLargeObjectsToDataRefs round-trips through dereferenceDataRefs", () => {
  it("returns the original object, not a buffer", async () => {
    const store = new Map<string, string>();
    let next = 0;
    const upload = async (data: string) => {
      const url = `https://storage.example.com/uploads/${next++}`;
      store.set(url, data);
      return url;
    };

    const original = {
      small: "unchanged",
      largeObject: {
        description: "Large dataset",
        values: Array.from({ length: 100 }, (_, i) => i),
      },
      largeArray: Array.from({ length: 100 }, (_, i) => ({ id: i })),
    };

    const converted = await convertLargeObjectsToDataRefs(
      original,
      100,
      upload
    );
    expect(typeof converted.largeObject).toBe("string");
    expect(typeof converted.largeArray).toBe("string");

    stubFetchFromStore(store);
    const result = await dereferenceDataRefs(converted);

    expect(result).toEqual(original);
  });
});

describe("serializeDataRefs uploads round-trip through deserializeDataRefs", () => {
  it("rebuilds an uploaded TypedArray", async () => {
    const store = new Map<string, ArrayBuffer>();
    const original = new Uint8Array(500).fill(7);

    const serialized = await serializeDataRefs(
      { data: original },
      {
        maxSizeBytes: 100,
        uploadFn: async (data) => {
          const url = "https://storage.example.com/uploads/typed";
          store.set(
            url,
            data instanceof Blob ? await data.arrayBuffer() : data
          );
          return url;
        },
      }
    );
    expect(serialized.data as unknown as string).toContain("text/x-uri");

    const deserialized = await deserializeDataRefs(serialized, {
      downloadFn: async (url) => store.get(url)!,
    });

    expect(deserialized.data).toBeInstanceOf(Uint8Array);
    expect(deserialized.data).toEqual(original);
  });

  it("rebuilds json uploaded via a custom download function", async () => {
    const url = "https://storage.example.com/uploads/json";
    const value = { deeply: { nested: [1, 2, 3] } };
    const dataUrl = `data:text/x-uri;type=object;charset=utf-8,${encodeURIComponent(
      url
    )}`;

    const deserialized = await deserializeDataRefs(
      { payload: dataUrl },
      {
        downloadFn: async () =>
          new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer,
      }
    );

    expect(deserialized.payload).toEqual(value);
  });
});
