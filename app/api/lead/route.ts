import { NextResponse } from "next/server";

/**
 * Tar imot lead fra skjemaet og sender det videre til pvwebsites sitt
 * /api/leads/create, slik at det havner i dashboardet som andre leads.
 * Uten LEADS_API_URL logges leadet bare (tørrmodus for utvikling).
 */

interface LeadBody {
  site?: string;
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  comment?: string;
  summary?: string;
  gclid?: string;
  fbclid?: string;
  utmCampaign?: string;
  /** Honningkrukke: skal være tom */
  website?: string;
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: LeadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  // Roboter fyller ut skjulte felt. Svar som om alt gikk bra.
  if (str(body.website)) return NextResponse.json({ success: true });

  const company = str(body.company, 200);
  const name = str(body.name, 200);
  const phone = str(body.phone, 40);
  const email = str(body.email, 200);
  const address = str(body.address, 300);

  if (!company || !name || !phone || !email || !address) {
    return NextResponse.json({ error: "Fyll ut alle feltene." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "E-postadressen ser ikke riktig ut." }, { status: 400 });
  }

  const site = str(body.site, 60).toLowerCase() || "smartelektrosol";
  const payload = {
    site,
    user_address: address,
    user_name: `${name} (${company})`,
    user_phone: phone,
    user_email: email,
    user_equipment: "Bedriftslading for tunge kjøretøy",
    user_comment: [str(body.comment, 2000), str(body.summary, 4000)].filter(Boolean).join("\n\n"),
    gclid: str(body.gclid, 200),
    fbclid: str(body.fbclid, 300),
    utmCampaign: str(body.utmCampaign, 200),
  };

  const target = process.env.LEADS_API_URL;
  if (!target) {
    console.info("[lead] Tørrmodus, LEADS_API_URL er ikke satt:", payload);
    return NextResponse.json({ success: true, dryRun: true });
  }

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[lead] Videresending feilet", res.status, await res.text().catch(() => ""));
      return NextResponse.json(
        { error: "Vi fikk ikke lagret henvendelsen. Prøv igjen, eller ring oss." },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[lead] Videresending feilet", err);
    return NextResponse.json(
      { error: "Vi fikk ikke lagret henvendelsen. Prøv igjen, eller ring oss." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
