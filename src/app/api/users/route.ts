import { NextResponse } from 'next/server';
import { pool } from '@/lib/fast-db';

export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_onboarding ORDER BY wallet_address LIMIT 10'
    );

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Database query failed' },
      { status: 500 }
    );
  }
}
