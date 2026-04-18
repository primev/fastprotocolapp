import { describe, it, expect } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson, parseSearchParams, parseParams } from "@/lib/api/parse"

// The parse helpers return `T | NextResponse` so callers can narrow via
// `instanceof NextResponse`. These tests lock both sides of that contract —
// happy path produces T, failure path produces a 400 response with a
// structured `issues` array that consumers rely on.

const bodySchema = z.object({ foo: z.string().min(1) })

describe("parseJson", () => {
  it("returns the parsed data on a valid body", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result).toEqual({ foo: "bar" })
  })

  it("returns a 400 NextResponse with issues[] for a missing field", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result).toBeInstanceOf(NextResponse)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400)
      const json = await result.json()
      expect(json.error).toBe("Invalid request")
      expect(json.issues[0].path).toBe("foo")
    }
  })

  it("returns a 400 for unparseable JSON", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result).toBeInstanceOf(NextResponse)
  })
})

describe("parseSearchParams", () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive(),
  })

  it("coerces string query params through the schema", () => {
    const req = new NextRequest("http://localhost/?page=3")
    const result = parseSearchParams(req, querySchema)
    expect(result).toEqual({ page: 3 })
  })

  it("returns 400 on coercion failure", () => {
    const req = new NextRequest("http://localhost/?page=not-a-number")
    const result = parseSearchParams(req, querySchema)
    expect(result).toBeInstanceOf(NextResponse)
  })
})

describe("parseParams", () => {
  const paramsSchema = z.object({ id: z.string().regex(/^\d+$/) })

  it("awaits the Next.js 15 params promise and validates", async () => {
    const result = await parseParams(Promise.resolve({ id: "42" }), paramsSchema)
    expect(result).toEqual({ id: "42" })
  })

  it("returns 400 when the segment is malformed", async () => {
    const result = await parseParams(Promise.resolve({ id: "abc" }), paramsSchema)
    expect(result).toBeInstanceOf(NextResponse)
  })
})
