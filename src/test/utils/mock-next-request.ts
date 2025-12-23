import { NextRequest } from 'next/server';

export function createMockRequest(
  body?: object,
  method: string = 'POST'
): NextRequest {
  return new NextRequest('http://localhost', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  });
}

export function createMockParams(wallet_address: string) {
  return { params: Promise.resolve({ wallet_address }) };
}

// Valid test wallet address
export const VALID_WALLET = '0x1234567890abcdef1234567890abcdef12345678';
export const INVALID_WALLET = 'invalid-wallet';
export const EMPTY_WALLET = '';
