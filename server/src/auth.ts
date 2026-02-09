import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const secretFromEnv = process.env.JWT_SECRET;
if (!secretFromEnv) {
  throw new Error("JWT_SECRET is not set in server/.env");
}
const JWT_SECRET: string = secretFromEnv;

export type JwtUser = {
  id: number;
  username: string;
  email: string;
};

export function signUser(user: JwtUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, JWT_SECRET) as unknown as JwtUser;
}
