// The Search API has been removed. Direct users to the Wizard feature.
export async function POST() {
  return new Response(
    JSON.stringify({ error: 'Search feature removed. Please use /wizard for the Hardware Setup Wizard.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function GET() {
  return new Response(
    JSON.stringify({ error: 'Search feature removed. Please use /wizard for the Hardware Setup Wizard.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
