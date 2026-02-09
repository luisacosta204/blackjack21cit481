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
      `insert into public.users (username, email, password_hash)
       values ($1, $2, $3)
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
