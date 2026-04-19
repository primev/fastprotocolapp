import { describe, it, expect } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson, parseSearchParams, parseParams } from "@/lib/api/parse"

// The parse helpers return a discriminated union (`{ ok, data } | { ok, response }`)
// so call sites can narrow with `if (!parsed.ok) return parsed.response`.
// These tests lock both sides of that contract — happy path produces
// `{ ok: true, data }`, failure path produces `{ ok: false, response }` where
// the response is a 400 with a structured `issues` array that consumers rely on.

const bodySchema = z.object({ foo: z.string().min(1) })

describe("parseJson", () => {
  it("returns { ok: true, data } on a valid body", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ foo: "bar" })
  })

  it("returns { ok: false } with a 400 response + issues[] for a missing field", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(400)
      const json = await result.response.json()
      expect(json.error).toBe("Invalid request")
      expect(json.issues[0].path).toBe("foo")
    }
  })

  it("returns { ok: false } with a 400 for unparseable JSON", async () => {
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    })
    const result = await parseJson(req, bodySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })
})

describe("parseSearchParams", () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive(),
  })

  it("coerces string query params through the schema", () => {
    const req = new NextRequest("http://localhost/?page=3")
    const result = parseSearchParams(req, querySchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ page: 3 })
  })

  it("returns { ok: false } on coercion failure", () => {
    const req = new NextRequest("http://localhost/?page=not-a-number")
    const result = parseSearchParams(req, querySchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })
})

describe("parseParams", () => {
  const paramsSchema = z.object({ id: z.string().regex(/^\d+$/) })

  it("awaits the Next.js 15 params promise and validates", async () => {
    const result = await parseParams(Promise.resolve({ id: "42" }), paramsSchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ id: "42" })
  })

  it("returns { ok: false } when the segment is malformed", async () => {
    const result = await parseParams(Promise.resolve({ id: "abc" }), paramsSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })
})
