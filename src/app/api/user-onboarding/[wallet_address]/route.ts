import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/fast-db';

/**
 * GET /api/user-onboarding/[wallet_address]
 * Read user onboarding data by wallet address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const { wallet_address } = await params;

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      'SELECT * FROM user_onboarding WHERE wallet_address = $1',
      [wallet_address.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
    const { wallet_address } = await params;

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      connect_wallet_completed,
      setup_rpc_completed,
      mint_sbt_completed,
      x_completed,
      telegram_completed,
      discord_completed,
      email_completed,
    } = body;

    // Check if user exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM user_onboarding WHERE wallet_address = $1',
      [wallet_address.toLowerCase()]
    );

    if (existingRows.length === 0) {
      // Create new user
      const { rows } = await pool.query(
        `INSERT INTO user_onboarding (
          wallet_address,
          connect_wallet_completed,
          setup_rpc_completed,
          mint_sbt_completed,
          x_completed,
          telegram_completed,
          discord_completed,
          email_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          wallet_address.toLowerCase(),
          connect_wallet_completed ?? false,
          setup_rpc_completed ?? false,
          mint_sbt_completed ?? false,
          x_completed ?? false,
          telegram_completed ?? false,
          discord_completed ?? false,
          email_completed ?? false,
        ]
      );

      return NextResponse.json({ user: rows[0] }, { status: 201 });
    } else {
      // Update existing user - only update provided fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (connect_wallet_completed !== undefined) {
        updateFields.push(`connect_wallet_completed = $${paramIndex++}`);
        updateValues.push(connect_wallet_completed);
      }
      if (setup_rpc_completed !== undefined) {
        updateFields.push(`setup_rpc_completed = $${paramIndex++}`);
        updateValues.push(setup_rpc_completed);
      }
      if (mint_sbt_completed !== undefined) {
        updateFields.push(`mint_sbt_completed = $${paramIndex++}`);
        updateValues.push(mint_sbt_completed);
      }
      if (x_completed !== undefined) {
        updateFields.push(`x_completed = $${paramIndex++}`);
        updateValues.push(x_completed);
      }
      if (telegram_completed !== undefined) {
        updateFields.push(`telegram_completed = $${paramIndex++}`);
        updateValues.push(telegram_completed);
      }
      if (discord_completed !== undefined) {
        updateFields.push(`discord_completed = $${paramIndex++}`);
        updateValues.push(discord_completed);
      }
      if (email_completed !== undefined) {
        updateFields.push(`email_completed = $${paramIndex++}`);
        updateValues.push(email_completed);
      }

      if (updateFields.length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      updateValues.push(wallet_address.toLowerCase());
      const { rows } = await pool.query(
        `UPDATE user_onboarding 
         SET ${updateFields.join(', ')}
         WHERE wallet_address = $${paramIndex}
         RETURNING *`,
        updateValues
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
    const { wallet_address } = await params;

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      connect_wallet_completed,
      setup_rpc_completed,
      mint_sbt_completed,
      x_completed,
      telegram_completed,
      discord_completed,
      email_completed,
    } = body;

    // Check if user exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM user_onboarding WHERE wallet_address = $1',
      [wallet_address.toLowerCase()]
    );

    if (existingRows.length === 0) {
      // Create new user with all fields
      const { rows } = await pool.query(
        `INSERT INTO user_onboarding (
          wallet_address,
          connect_wallet_completed,
          setup_rpc_completed,
          mint_sbt_completed,
          x_completed,
          telegram_completed,
          discord_completed,
          email_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          wallet_address.toLowerCase(),
          connect_wallet_completed ?? false,
          setup_rpc_completed ?? false,
          mint_sbt_completed ?? false,
          x_completed ?? false,
          telegram_completed ?? false,
          discord_completed ?? false,
          email_completed ?? false,
        ]
      );

      return NextResponse.json({ user: rows[0] }, { status: 201 });
    } else {
      // Full update existing user
      const { rows } = await pool.query(
        `UPDATE user_onboarding 
         SET 
           connect_wallet_completed = $1,
           setup_rpc_completed = $2,
           mint_sbt_completed = $3,
           x_completed = $4,
           telegram_completed = $5,
           discord_completed = $6,
           email_completed = $7
         WHERE wallet_address = $8
         RETURNING *`,
        [
          connect_wallet_completed ?? false,
          setup_rpc_completed ?? false,
          mint_sbt_completed ?? false,
          x_completed ?? false,
          telegram_completed ?? false,
          discord_completed ?? false,
          email_completed ?? false,
          wallet_address.toLowerCase(),
        ]
      );

      return NextResponse.json({ user: rows[0] });
    }
  } catch (err) {
    console.error('Error updating user onboarding:', err);
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    );
  }
}
