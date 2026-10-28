import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eliminaOriginaliScaduti } from "@/lib/pulizia";

export const dynamic = "force-dynamic";

// Chiamata ogni giorno da Vercel Cron (vercel.json). Vercel manda «Authorization: Bearer <CRON_SECRET>».
function autorizzata(request: NextRequest) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) return false;
  const atteso = Buffer.from(`Bearer ${segreto}`);
  const ricevuto = Buffer.from(request.headers.get("authorization") ?? "");
  return atteso.length === ricevuto.length && timingSafeEqual(atteso, ricevuto);
}

export async function GET(request: NextRequest) {
  if (!autorizzata(request)) return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });
  try {
    return NextResponse.json(await eliminaOriginaliScaduti(createAdminClient()));
  } catch (e) {
    console.error("pulizia-originali", e);
    return NextResponse.json({ errore: "pulizia non riuscita" }, { status: 500 });
  }
}
