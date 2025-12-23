import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/fast-db';

// Single source of truth for onboarding fields
const ONBOARDING_FIELDS = [
  'connect_wallet_completed',
  'setup_rpc_completed',
  'mint_sbt_completed',
  'make_first_swap_completed',
  'x_completed',
  'telegram_completed',
  'discord_completed',
  'email_completed',
] as const;

type OnboardingField = (typeof ONBOARDING_FIELDS)[number];

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Extract wallet address from params with validation
async function getValidatedWalletAddress(
  params: Promise<{ wallet_address: string }>
): Promise<{ address: string } | { error: NextResponse }> {
  const { wallet_address } = await params;

  if (!wallet_address) {
    return {
      error: NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      ),
    };
  }

  if (!isValidWalletAddress(wallet_address)) {
    return {
      error: NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      ),
    };
  }

  return { address: wallet_address.toLowerCase() };
}

/**
 * GET /api/user-onboarding/[wallet_address]
 * Read user onboarding data by wallet address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const result = await getValidatedWalletAddress(params);
    if ('error' in result) return result.error;

    const { rows } = await pool.query(
      'SELECT * FROM user_onboarding WHERE wallet_address = $1',
      [result.address]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (err) {
    console.error('Error fetching user onboarding:', err);
    return NextResponse.json(
      { error: 'Database query failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-onboarding/[wallet_address]
 * Create or update user onboarding data by wallet address
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const result = await getValidatedWalletAddress(params);
    if ('error' in result) return result.error;

    const body = await request.json();

    // Check if user exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM user_onboarding WHERE wallet_address = $1',
      [result.address]
    );

    if (existingRows.length === 0) {
      // Create new user with defaults for missing fields
      const values = ONBOARDING_FIELDS.map((field) => body[field] ?? false);
      const placeholders = ONBOARDING_FIELDS.map((_, i) => `$${i + 2}`).join(
        ', '
      );

      const { rows } = await pool.query(
        `INSERT INTO user_onboarding (wallet_address, ${ONBOARDING_FIELDS.join(
          ', '
        )})
         VALUES ($1, ${placeholders})
         RETURNING *`,
        [result.address, ...values]
      );

      return NextResponse.json({ user: rows[0] }, { status: 201 });
    } else {
      // Update only provided fields
      const updates: { field: OnboardingField; value: boolean }[] = [];
      for (const field of ONBOARDING_FIELDS) {
        if (body[field] !== undefined) {
          updates.push({ field, value: body[field] });
        }
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      const setClause = updates
        .map((u, i) => `${u.field} = $${i + 1}`)
        .join(', ');
      const values = updates.map((u) => u.value);

      const { rows } = await pool.query(
        `UPDATE user_onboarding
         SET ${setClause}
         WHERE wallet_address = $${updates.length + 1}
         RETURNING *`,
        [...values, result.address]
      );

      return NextResponse.json({ user: rows[0] });
    }
  } catch (err) {
    console.error('Error creating/updating user onboarding:', err);
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user-onboarding/[wallet_address]
 * Full update (replace) user onboarding data by wallet address
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const result = await getValidatedWalletAddress(params);
    if ('error' in result) return result.error;

    const body = await request.json();
    const values = ONBOARDING_FIELDS.map((field) => body[field] ?? false);

    // Upsert: insert or update all fields
    const { rows } = await pool.query(
      `INSERT INTO user_onboarding (wallet_address, ${ONBOARDING_FIELDS.join(
        ', '
      )})
       VALUES ($1, ${ONBOARDING_FIELDS.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (wallet_address)
       DO UPDATE SET ${ONBOARDING_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(
         ', '
       )}
       RETURNING *`,
      [result.address, ...values]
    );

    return NextResponse.json(
      { user: rows[0] },
      { status: rows[0] ? 200 : 201 }
    );
  } catch (err) {
    console.error('Error updating user onboarding:', err);
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    );
  }
}
