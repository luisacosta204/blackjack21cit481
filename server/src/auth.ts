import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in server/.env");
}

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
