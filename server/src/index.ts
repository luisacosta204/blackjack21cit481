import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
import bcrypt from "bcrypt";
import { signUser, verifyToken } from "./auth";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/db-check", async (_req, res) => {
  try {
    const result = await pool.query("select now() as now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "DB connection failed" });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ ok: false, error: "Password too short" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `insert into public.users (username, email, password_hash, last_daily_bonus)
       values ($1, $2, $3, NOW() - INTERVAL '25 hours')
       returning id, username, email, credits, created_at`,
      [username, email, password_hash]
    );

    const user = result.rows[0];
    const token = signUser({ id: user.id, username: user.username, email: user.email });

    res.json({ ok: true, token, user });
  } catch (err: any) {
    // handle unique constraint violations nicely
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body ?? {};

    if (!identifier || !password) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const result = await pool.query(
      `select id, username, email, password_hash, credits, created_at
       from public.users
       where email = $1 or username = $1
       limit 1`,
      [identifier]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const userRow = result.rows[0];
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signUser({ id: userRow.id, username: userRow.username, email: userRow.email });

    // never send password_hash back
    const { password_hash, ...user } = userRow;
    res.json({ ok: true, token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);

    const result = await pool.query(
      `select id, username, email, credits, created_at
       from public.users
       where id = $1`,
      [jwtUser.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(401).json({ ok: false, error: "Invalid token" });
  }
});

// ============================================================================
// MODIFIED: /game-results - Now accepts game_type
// ============================================================================
app.post("/game-results", async (req, res) => {
  try {
    // Extract JWT
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);

    // Extract Body - NOW WITH game_type
    const { won, delta, game_type } = req.body ?? {};
    
    if (typeof won !== "boolean" || typeof delta !== "number") {
      return res.status(400).json({ ok: false, error: "Invalid body (won: boolean, delta: number)" });
    }
    
    if (!game_type || typeof game_type !== "string") {
      return res.status(400).json({ ok: false, error: "game_type is required (string)" });
    }

    // Lookup game_type_id
    const gameTypeResult = await pool.query(
      `SELECT id FROM game_types WHERE name = $1`,
      [game_type]
    );
    
    if (gameTypeResult.rowCount === 0) {
      return res.status(400).json({ ok: false, error: `Invalid game_type: ${game_type}` });
    }
    
    const game_type_id = gameTypeResult.rows[0].id;

    // Insert Game Results with game_type_id
    const result = await pool.query(
      `INSERT INTO public.game_results (user_id, game_type_id, won, delta, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [jwtUser.id, game_type_id, won, delta]
    );

    res.json({ ok: true, game_result_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/account/email", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";

    if (!rawEmail) {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }

    const email = rawEmail.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address" });
    }

    const result = await pool.query(
      `update public.users set email = $1 where id = $2 returning email`,
      [email, jwtUser.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    res.json({ ok: true, email: result.rows[0].email });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ ok: false, error: "That email is already in use" });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/update-credits", async (req, res) => {
  try {
    // Extract JWT
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);

    // Extract new credits amount
    const { credits } = req.body ?? {};
    if (typeof credits !== "number") {
      return res.status(400).json({ ok: false, error: "Invalid credits value" });
    }

    // Update user's credits in database
    await pool.query(
      `UPDATE users SET credits = $1 WHERE id = $2`,
      [credits, jwtUser.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ============================================================================
// NEW: /sessions/start - Start a game session
// ============================================================================
app.post("/sessions/start", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);
    const { game_type } = req.body ?? {};
    
    if (!game_type || typeof game_type !== "string") {
      return res.status(400).json({ ok: false, error: "game_type is required" });
    }

    // Get current user credits
    const userResult = await pool.query(
      `SELECT credits FROM users WHERE id = $1`,
      [jwtUser.id]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    
    const starting_credits = userResult.rows[0].credits;

    // Create session
    const sessionResult = await pool.query(
      `INSERT INTO game_sessions 
       (user_id, game_type_id, starting_credits, is_active)
       VALUES ($1, 
               (SELECT id FROM game_types WHERE name = $2),
               $3, 
               true)
       RETURNING id`,
      [jwtUser.id, game_type, starting_credits]
    );

    res.json({ 
      ok: true, 
      session_id: sessionResult.rows[0].id,
      starting_credits 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ============================================================================
// NEW: /sessions/end - End a game session
// ============================================================================
app.post("/sessions/end", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);
    const { session_id } = req.body ?? {};
    
    if (!session_id || typeof session_id !== "number") {
      return res.status(400).json({ ok: false, error: "session_id is required (number)" });
    }

    // Get current user credits
    const userResult = await pool.query(
      `SELECT credits FROM users WHERE id = $1`,
      [jwtUser.id]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }
    
    const ending_credits = userResult.rows[0].credits;

    // Count total rounds in this session
    const roundsResult = await pool.query(
      `SELECT COUNT(*) as total_rounds 
       FROM game_results 
       WHERE user_id = $1 
         AND created_at >= (SELECT started_at FROM game_sessions WHERE id = $2)`,
      [jwtUser.id, session_id]
    );
    
    const total_rounds = parseInt(roundsResult.rows[0]?.total_rounds || 0);

    // End the session
    await pool.query(
      `UPDATE game_sessions 
       SET ended_at = NOW(),
           ending_credits = $1,
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INT,
           net_winnings = $1 - starting_credits,
           total_rounds = $2,
           is_active = false
       WHERE id = $3 AND user_id = $4`,
      [ending_credits, total_rounds, session_id, jwtUser.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ============================================================================
// NEW: /detailed-results - Store detailed game-specific data
// ============================================================================
app.post("/detailed-results", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);
    
    const { 
      game_result_id, 
      session_id, 
      game_type, 
      bet_amount, 
      payout_amount, 
      game_data 
    } = req.body ?? {};
    
    // Validation
    if (!game_result_id || !game_type || bet_amount == null || payout_amount == null || !game_data) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing required fields: game_result_id, game_type, bet_amount, payout_amount, game_data" 
      });
    }

    // Insert detailed result
    await pool.query(
      `INSERT INTO detailed_game_results 
       (game_result_id, session_id, game_type_id, user_id, bet_amount, payout_amount, game_data)
       VALUES (
         $1,
         $2,
         (SELECT id FROM game_types WHERE name = $3),
         $4,
         $5,
         $6,
         $7::jsonb
       )`,
      [game_result_id, session_id, game_type, jwtUser.id, bet_amount, payout_amount, JSON.stringify(game_data)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ============================================================================
// LEADERBOARD ROUTES - Explicit routes for both with and without game_type
// ============================================================================

// Overall leaderboard (all games)
app.get("/leaderboard", async (_req, res) => {
  try {
    const query = `
      SELECT 
        u.username,
        COUNT(gr.id)::int as total_games,
        SUM(CASE WHEN gr.won THEN 1 ELSE 0 END)::int as wins,
        SUM(CASE WHEN gr.won THEN 0 ELSE 1 END)::int as losses,
        SUM(gr.delta)::int as net_winnings
      FROM users u
      LEFT JOIN game_results gr ON u.id = gr.user_id
      GROUP BY u.id, u.username
      HAVING COUNT(gr.id) > 0
      ORDER BY net_winnings DESC
      LIMIT 10
    `;

    const result = await pool.query(query);
    res.json({ ok: true, leaderboard: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch leaderboard" });
  }
});

// Game-specific leaderboard
app.get("/leaderboard/:game_type", async (req, res) => {
  try {
    const { game_type } = req.params;
    
    if (game_type === 'all') {
      // Redirect to overall leaderboard
      const query = `
        SELECT 
          u.username,
          COUNT(gr.id)::int as total_games,
          SUM(CASE WHEN gr.won THEN 1 ELSE 0 END)::int as wins,
          SUM(CASE WHEN gr.won THEN 0 ELSE 1 END)::int as losses,
          SUM(gr.delta)::int as net_winnings
        FROM users u
        LEFT JOIN game_results gr ON u.id = gr.user_id
        GROUP BY u.id, u.username
        HAVING COUNT(gr.id) > 0
        ORDER BY net_winnings DESC
        LIMIT 10
      `;
      const result = await pool.query(query);
      return res.json({ ok: true, leaderboard: result.rows });
    }

    // Game-specific leaderboard
    const query = `
      SELECT 
        u.username,
        gt.display_name as game_type,
        COUNT(gr.id)::int as total_games,
        SUM(CASE WHEN gr.won THEN 1 ELSE 0 END)::int as wins,
        SUM(CASE WHEN gr.won THEN 0 ELSE 1 END)::int as losses,
        SUM(gr.delta)::int as net_winnings
      FROM users u
      LEFT JOIN game_results gr ON u.id = gr.user_id
      LEFT JOIN game_types gt ON gr.game_type_id = gt.id
      WHERE gt.name = $1
      GROUP BY u.id, u.username, gt.display_name
      HAVING COUNT(gr.id) > 0
      ORDER BY net_winnings DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [game_type]);
    res.json({ ok: true, leaderboard: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch leaderboard" });
  }
});

// ============================================================================
// NEW: /stats/user - Get user's game-specific statistics
// ============================================================================
app.get("/stats/user", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });
 
    const jwtUser = verifyToken(token);
 
    const result = await pool.query(`
      SELECT 
        gt.name as game_type,
        gt.display_name as game_name,
        COUNT(gr.id)::int as total_games,
        SUM(CASE WHEN gr.won THEN 1 ELSE 0 END)::int as wins,
        SUM(CASE WHEN gr.won THEN 0 ELSE 1 END)::int as losses,
        COALESCE(SUM(gr.delta), 0)::int as net_winnings,
        COALESCE(MAX(gr.delta), 0)::int as biggest_win,
        COALESCE(MIN(gr.delta), 0)::int as biggest_loss,
        ROUND(
          CASE 
            WHEN COUNT(gr.id) > 0 
            THEN (SUM(CASE WHEN gr.won THEN 1 ELSE 0 END)::float / COUNT(gr.id)::float) * 100 
            ELSE 0 
          END::numeric, 
          1
        ) as win_rate
      FROM game_types gt
      LEFT JOIN game_results gr ON gt.id = gr.game_type_id AND gr.user_id = $1
      GROUP BY gt.id, gt.name, gt.display_name
      ORDER BY gt.id
    `, [jwtUser.id]);
 
    res.json({ ok: true, stats: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ============================================================================
// NEW: DAILY BONUS ENDPOINTS
// ============================================================================

// POST /daily-bonus - Claim daily 200 credits bonus (once per 24 hours)
app.post("/daily-bonus", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);

    // Get user's current credits and last bonus claim time
    const userResult = await pool.query(
      "SELECT credits, last_daily_bonus FROM users WHERE id = $1",
      [jwtUser.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const { credits, last_daily_bonus } = userResult.rows[0];

    // Check if 24 hours have passed since last claim
    const now = new Date();
    const lastBonus = last_daily_bonus ? new Date(last_daily_bonus) : null;
    
    if (lastBonus) {
      const hoursSinceLastBonus = (now.getTime() - lastBonus.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastBonus < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastBonus);
        return res.json({
          ok: false,
          error: "Daily bonus already claimed",
          hoursRemaining,
          nextBonusAt: new Date(lastBonus.getTime() + 24 * 60 * 60 * 1000),
        });
      }
    }

    // Grant the bonus
    const DAILY_BONUS = 200;
    const newCredits = credits + DAILY_BONUS;

    await pool.query(
      "UPDATE users SET credits = $1, last_daily_bonus = NOW() WHERE id = $2",
      [newCredits, jwtUser.id]
    );

    res.json({
      ok: true,
      bonusAmount: DAILY_BONUS,
      newCredits,
      message: "Daily bonus claimed! +200 credits",
    });
  } catch (error) {
    console.error("Error claiming daily bonus:", error);
    res.status(500).json({ ok: false, error: "Failed to claim daily bonus" });
  }
});

// GET /daily-bonus/status - Check if daily bonus is available
app.get("/daily-bonus/status", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const jwtUser = verifyToken(token);

    const result = await pool.query(
      "SELECT last_daily_bonus FROM users WHERE id = $1",
      [jwtUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const { last_daily_bonus } = result.rows[0];
    const now = new Date();
    const lastBonus = last_daily_bonus ? new Date(last_daily_bonus) : null;

    if (!lastBonus) {
      return res.json({
        ok: true,
        available: true,
        message: "Daily bonus available!",
      });
    }

    const hoursSinceLastBonus = (now.getTime() - lastBonus.getTime()) / (1000 * 60 * 60);
    const available = hoursSinceLastBonus >= 24;
    const hoursRemaining = available ? 0 : Math.ceil(24 - hoursSinceLastBonus);
    const nextBonusAt = available ? null : new Date(lastBonus.getTime() + 24 * 60 * 60 * 1000);

    res.json({
      ok: true,
      available,
      hoursRemaining,
      nextBonusAt,
      lastClaimedAt: lastBonus,
    });
  } catch (error) {
    console.error("Error checking daily bonus status:", error);
    res.status(500).json({ ok: false, error: "Failed to check bonus status" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});