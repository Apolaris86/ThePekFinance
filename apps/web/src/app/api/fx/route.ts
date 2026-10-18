import { connection } from "next/server";
import { getFxRates } from "@/server/data";
import { respond } from "@/server/http";

export async function GET() {
  await connection();
  return respond(() => getFxRates());
}
